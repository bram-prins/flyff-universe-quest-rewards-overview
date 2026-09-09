import fetch from 'node-fetch';
import { readFile, writeFile } from 'fs/promises';

const fetchUrl = async (url) => {
    try {
        const delay = new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay per request to not overload API
        await delay;
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        throw new Error('Error fetching ' + url + ': ' + error);
    }
};

const updateLog = (message) => {
    process.stdout.clearLine(0); 
    process.stdout.cursorTo(0);  
    process.stdout.write(message); 
}

const allQuests = new Map();

const getQuests = async () => {
    console.log('Fetching quests from API...');
    const allQuestsList =  await fetchUrl('https://api.flyff.com/quest');

    let i = 0;
    for (const questId of allQuestsList) {
        const quest = await fetchUrl('https://api.flyff.com/quest/' + questId);
        allQuests.set(quest.id, quest);
        i++;
        updateLog('Progress: ' + ((i / allQuestsList.length * 100).toFixed(2)) + '%');
    }
    process.stdout.write("\n"); 

    // writeFile('questsTemp.json', JSON.stringify(Array.from(allQuests.values())));    
    // const questsTemp = await readFile('questsTemp.json', 'utf-8');
    // for (const quest of JSON.parse(questsTemp)) {
    //     allQuests.set(quest.id, quest);
    // }

    // Add parent & grandparent properties to the list, to show those in the table too
    const excludeParents = ['1st Job Change', '2nd Job Change', '3rd Job Change ', 'Couple Daily Quests', 'P.K'];
    const doableQuests = [];
    for (const quest of allQuests.values()) {
        if (!quest.beginNPC)
            continue;

        if (quest.parent == null)
            continue;

        const parent = allQuests.get(quest.parent);
        if (parent == null || parent.parent == null || excludeParents.includes(parent.name.en))
            continue;

        quest.parentName = parent.name.en;
        const grandparent = allQuests.get(parent.parent);
        if (grandparent != null) {
            quest.grandparentName = grandparent.name.en;
        }

        doableQuests.push(quest);
    }

    return doableQuests;
};

const mapQuests = async () => {
    const quests = await getQuests();
    
    console.log('Mapping data...');
    const mapped = [];
    const warnings = [];

    // First, define the different quest chains. This will help us to sort the quests properly
    const chains = [];

    const mapChain = (chain, previousQuestId) => {
        chain.push(previousQuestId);

        const nextQuests = quests
            .filter(q => q.beginQuests && q.beginQuests.find(bq => bq.quest == previousQuestId))
            .map(q => q.id);

        if (nextQuests.length == 0)
            return;

        for (const nextQuestId of nextQuests) {
            mapChain(chain, nextQuestId);
        }
    };

    const startQuests = quests.filter(q => 
        (q.type == 'chain' || q.type == 'category') &&      // Some API quest data is faulty and some chain have type 'category' 
        (!q.beginQuests || q.beginQuests.length == 0 || q.beginQuests.every(bq => allQuests.get(bq.quest)?.parent != q.parent)));
    for (const startQuest of startQuests) {
        if (chains.find(c => c.includes(startQuest.id)))
            continue;

        const chain = [];
        mapChain(chain, startQuest.id);
        chains.push(chain);
    }

    // Second, add them all to the new array with the needed properties
    const itemCache = new Map();
    const npcCache = new Map();

    let i = 0;
    for (const quest of quests) {
        try {
            let category;
            let chain;
            let chainId;
            let chainPosition;
            let chainStartLvl;
            if (quest.type == 'chain') {
                category = 'Chain'
                chain = chains.find(c => c.includes(quest.id))
                if (!chain)
                    throw new Error('Quest ' + quest.id + ' is a chain quest but is not part of any chain');

                chainId = chains.indexOf(chain);
                chainPosition = chain.indexOf(quest.id);
                chainStartLvl = allQuests.get(chain[0]).minLevel;
            } else if (quest.type == 'daily') {
                category = 'Daily';
            } else {
                category = quest.grandparentName;
            }
            
            // Only add real item rewards (not the quest items that you have to hand in for a next quest)
            const items = []
            let endReceiveItems = quest.endReceiveItems ?? [];
            if (chain && chainPosition < chain.length - 1) {
                const nextQuestId = chain[chainPosition + 1];
                const nextQuest = allQuests.get(nextQuestId);
                endReceiveItems = endReceiveItems.filter(item => !nextQuest.endRemoveItems || !nextQuest.endRemoveItems.find(temp => item.item == temp.item));
            }
            for (const item of endReceiveItems) {
                if (!itemCache.has(item.item)) {
                    try {
                        const itemInfo = await fetchUrl('https://api.flyff.com/item/' + item.item);
                        item.name = itemInfo.name.en;
                    } catch (error) {
                        item.name = '?';
                        warnings.push('Error mapping quest ' + quest.id + ': Error fetching item info for item ' + item.item + ': ' + error);
                    }

                    itemCache.set(item.item, item);
                } else {
                    item.name = itemCache.get(item.item).name;
                }
                
                items.push(itemCache.get(item.item));
            }

            let startNpcName;
            if (!npcCache.has(quest.beginNPC)) {
                try {
                    const startNpcInfo = await fetchUrl('https://api.flyff.com/npc/' + quest.beginNPC);
                    startNpcName = startNpcInfo.name.en;

                }
                catch (error) {
                    warnings.push('Error mapping quest ' + quest.id + ': Error fetching NPC info for NPC ' + quest.beginNPC + ': ' + error);
                    startNpcName = '?';
                }

                npcCache.set(quest.beginNPC, startNpcName);
            } else {
                startNpcName = npcCache.get(quest.beginNPC);
            }

            mapped.push({
                id: quest.id,
                category: category,
                name: quest.name && quest.name.en ? quest.name.en : '?',
                startNpc: quest.beginNPC,
                startNpcName,
                minLevel: quest.minLevel,
                parentId: quest.parent,
                parentName: quest.type == 'chain' ? quest.parentName : '',
                chainId,
                chainStartLvl,
                chainPosition,
                exp: quest.endReceiveExperience,
                penya: quest.endReceiveGold,
                items,
                inventorySlots: quest.endReceiveInventorySpaces,
                repeatable: quest.repeatable
            });

            i++;
            updateLog('Progress: ' + ((i / quests.length * 100).toFixed(2)) + '%');
        } catch (error) {
            error.message = 'Error processing quest ' + quest.id + ': ' + error.message;
            throw error;
        }
    }

    process.stdout.write("\n"); 
    for (const warning of warnings) {
        console.warn('Warning: ' + warning);
    }

    return mapped.sort((a,b) => {
        const aLvl = a.chainStartLvl ? a.chainStartLvl : a.minLevel;
        const bLvl = b.chainStartLvl ? b.chainStartLvl : b.minLevel;
        return aLvl - bLvl || a.chainId - b.chainId || a.chainPosition - b.chainPosition || a.category.localeCompare(b.category);
    })
}

export default mapQuests




