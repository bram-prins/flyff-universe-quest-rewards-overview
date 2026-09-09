import fetch from 'node-fetch';
import { readFile, writeFile } from 'fs/promises';

const fetchEndpoint = async (endpoint) => {
    const baseUrl = 'https://api.flyff.com';
    if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
    }

    try {
        const delay = new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay per request to not overload API
        await delay;
        const response = await fetch(baseUrl + endpoint);
        if (!response.ok)
            throw new Error(`${response.status}: ${await response.text()}`);

        return await response.json();
    } catch (error) {
        throw new Error(`Error fetching ${endpoint}: ${error.message}`);
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
    const allQuestsList =  await fetchEndpoint('/quest');

    let i = 0;
    for (const questId of allQuestsList) {
        const quest = await fetchEndpoint('/quest/' + questId);
        allQuests.set(quest.id, quest);
        i++;
        updateLog('Progress: ' + ((i / allQuestsList.length * 100).toFixed(2)) + '%');
    }
    process.stdout.write("\n"); 

    // writeFile('temp/questsTemp.json', JSON.stringify(Array.from(allQuests.values())));    
    // const questsTemp = await readFile('temp/questsTemp.json', 'utf-8');
    // for (const quest of JSON.parse(questsTemp)) {
    //     allQuests.set(quest.id, quest);
    // }

    // Add parent & grandparent properties to the list, to show those in the table too
    const excludeParents = ['1st Job Change', '2nd Job Change', '3rd Job Change', 'Couple Daily Quests', 'P.K'];
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

const mapChains = (quests, warnings) => {
    const chains = [];

    const mapChain = (chain, previousQuestId) => {
        chain.push(previousQuestId);

        const nextQuests = quests
            .filter(q => q.beginQuests && q.beginQuests.find(bq => bq.quest == previousQuestId))
            .sort((a, b) => {
                // If multiple next quests, sort them as follows
                const aNextQuestMinLevel = quests.find(q => q.beginQuests && q.beginQuests.find(bq => bq.quest == a.id))?.minLevel;
                const bNextQuestMinLevel = quests.find(q => q.beginQuests && q.beginQuests.find(bq => bq.quest == b.id))?.minLevel;
                if (bNextQuestMinLevel && !aNextQuestMinLevel) return -1;
                if (aNextQuestMinLevel && !bNextQuestMinLevel) return 1;
                return a.minLevel - b.minLevel || aNextQuestMinLevel - bNextQuestMinLevel
            })
            .map(q => q.id);

        if (nextQuests.length == 0)
            return;

        if (nextQuests.length > 1) {
            warnings.push(`Quest ${previousQuestId} has multiple following quests: ${nextQuests.join(', ')}`);
        }

        for (const nextQuestId of nextQuests) {
            mapChain(chain, nextQuestId);
        }
    };

    // Faulty API data: some chain quests have type 'category' 
    const startQuests = quests.filter(q => (q.type == 'chain' || q.type == 'category') && (!q.beginQuests || q.beginQuests.length == 0));
    for (const startQuest of startQuests) {
        if (chains.find(c => c.includes(startQuest.id)))
            continue;

        const chain = [];
        mapChain(chain, startQuest.id);
        if (chain.length > 1) {
            chain.forEach(questId => {
                const quest = allQuests.get(questId);
                if (quest.type == 'category') {
                    warnings.push('Quest ' + questId + ' has type "category" but is a "chain" quest');
                    quest.type = 'chain';
                }
            })
            chains.push(chain)
        }
    }

    return chains;
}

const mapQuests = async () => {
    const quests = await getQuests();
    
    console.log('Mapping data and fetching item and NPC info from API...');
    const mapped = [];
    const warnings = [];

    const chains = mapChains(quests, warnings);

    const cachedItems = new Map();
    const cachedNpcs = new Map();

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
                if (!chain) {
                    warnings.push('Quest ' + quest.id + ' is a chain quest but is not part of any chain');
                } else {
                    chainId = chains.indexOf(chain);
                    chainPosition = chain.lastIndexOf(quest.id);
                    chainStartLvl = allQuests.get(chain[0]).minLevel;
                }
            } else if (quest.type == 'daily') {
                category = 'Daily';
            } else {
                category = quest.grandparentName;
            }
            
            // Only add real item rewards (not the quest items that you have to hand in for a next quest)
            const items = []
            let endReceiveItems = quest.endReceiveItems ?? [];
            if (chain && chainPosition < chain.length - 1) {
                const followingQuests = chain.slice(chainPosition).map(id => allQuests.get(id));
                endReceiveItems = endReceiveItems.filter(item => 
                    !followingQuests.find(q => q.endRemoveItems && q.endRemoveItems.find(temp => item.item == temp.item)));
            }
            for (const item of endReceiveItems) {
                if (!cachedItems.has(item.item)) {
                    try {
                        const itemInfo = await fetchEndpoint('/item/' + item.item);
                        item.name = itemInfo.name.en;
                    } catch (error) {
                        item.name = '?';
                        warnings.push(`Error fetching item info for item ${item.item}: ${error} (Quest id: ${quest.id})`);
                    }

                    cachedItems.set(item.item, item);
                } else {
                    item.name = cachedItems.get(item.item).name;
                }
                
                items.push(cachedItems.get(item.item));
            }

            let startNpcName;
            if (!cachedNpcs.has(quest.beginNPC)) {
                try {
                    const startNpcInfo = await fetchEndpoint('/npc/' + quest.beginNPC);
                    startNpcName = startNpcInfo.name.en;
                }
                catch (error) {
                    warnings.push(`Error fetching NPC info for NPC ${quest.beginNPC}: ${error} (Quest id: ${quest.id})`);
                    startNpcName = '?';
                }

                cachedNpcs.set(quest.beginNPC, startNpcName);
            } else {
                startNpcName = cachedNpcs.get(quest.beginNPC);
            }

            mapped.push({
                id: quest.id,
                category,
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




