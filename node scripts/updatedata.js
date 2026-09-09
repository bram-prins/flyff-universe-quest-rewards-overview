import fetch from 'node-fetch';
import path from 'path';
import { readFile, writeFile } from 'fs/promises';

/**
 * Fetches data from flyff API
 * @param {string} endpoint API endpoint to fetch
 * @returns {Promise<object>} result object, if successful
 */
const fetchEndpoint = async (endpoint) => {
    const baseUrl = 'https://api.flyff.com';
    const url = baseUrl + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);

    const delay = new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay per request to not overload API
    await delay;
    const response = await fetch(url);
    if (!response.ok) {
        const err = { requestUrl: url, status: response.status }
        try {
            const json = await response.json();
            err.message = json.message ?? json.error ?? '';
        } catch {} // ignore
        
        throw new Error(JSON.stringify(err, null, 2))
    }

    return await response.json();;
};

/**
 * Helper function to log progress of a process on the same line
 * @param {string} message Log line to be updated (such as "Progress: XX%")
 */
const updateLog = (message) => {
    process.stdout.clearLine(0); 
    process.stdout.cursorTo(0);  
    process.stdout.write(message); 
}

/**
 * Map that stores all quests for later lookup
 */
const allQuests = new Map();

/**
 * Fetches all the quests from the API, stores them in @see allQuests , and returns a filtered array of
 * the quests based on whether they're relevant for the overview:
 * - Only doable/base-level quests (so no parents, categories, etc)
 * - No Job Change, Couple and P.K. quests 
 * @returns {array} Filtered array with the doable quests
 */
const getQuests = async () => {
    console.log('Fetching quests from the API...');

    // 1. Fetch all quests into allQuests
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

    const excludeParents = ['1st Job Change', '2nd Job Change', '3rd Job Change', 'Couple Daily Quests', 'P.K'];
    const doableQuests = [];
    for (const quest of allQuests.values()) {
        // Filter out the non-doable quests (parents, categories, etc.) based on whether they have a start NPC
        if (!quest.beginNPC)
            continue;

        if (quest.parent == null)
            continue;

        const parent = allQuests.get(quest.parent);

        // Filter out Job Change, Couple and P.K. quests
        if (parent == null || parent.parent == null || excludeParents.includes(parent.name.en))
            continue;

        // Add parentName & grandparentName properties to the quests, to be used/shown later
        quest.parentName = parent.name.en;
        const grandparent = allQuests.get(parent.parent);
        if (grandparent != null) {
            quest.grandparentName = grandparent.name.en;
        }

        doableQuests.push(quest);
    }

    return doableQuests;
};

/**
 * Gets an array of arrays with all chain quests ordered
 * @param {array} quests All quests from @see getQuests
 * @param {array} warnings The array of warnings to add messages to if necessary, to be logged at the end of the script
 * @returns {array} An array of arrays with all the chain quest ID's in order
 */
const mapChains = (quests, warnings) => {
    const chains = [];

    // Recursive function to find the next quest of each quest
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

    // First find all the start quests of chains (that don't have a preceding quest), and start mapping from there
    // Note: some chain quests have type 'category' instead of 'chain' (faulty API data)
    const startQuests = quests.filter(q => (q.type == 'chain' || q.type == 'category') && (!q.beginQuests || q.beginQuests.length == 0));
    for (const startQuest of startQuests) {
        if (chains.find(c => c.includes(startQuest.id)))
            continue;

        const chain = [];
        mapChain(chain, startQuest.id);
        if (chain.length > 1) {
            chain.forEach(questId => {
                // Correct the aforementioned faulty type if necessary
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

/**
 * Maps all the quests from @see getQuests to the format for the overview, by adding some properties,
 * and sorts them by level but with the quest chains grouped
 * @returns {array} The formatted and sorted quests for the overview (to write to ../data/quests.json)
 */
const mapQuests = async () => {
    const quests = await getQuests();
    
    console.log('Fetching item and NPC info from the API and mapping the quest data...');
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

            // Use type or grandparentName as the Category, which are clearer than the category from the API
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
            
            // Map item rewards:
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
                        warnings.push(`Error fetching item info for item ${item.item} (Quest id: ${quest.id}):\n${error.message}`);
                        item.name = '?';
                    }
                    cachedItems.set(item.item, item.name);
                } else {
                    item.name = cachedItems.get(item.item);
                }
                
                items.push(item);
            }

            // Get the start NPC name
            let startNpcName;
            if (!cachedNpcs.has(quest.beginNPC)) {
                try {
                    const startNpcInfo = await fetchEndpoint('/npc/' + quest.beginNPC);
                    startNpcName = startNpcInfo.name.en;
                }
                catch (error) {
                    warnings.push(`Error fetching NPC info for NPC ${quest.beginNPC} (Quest id: ${quest.id}):\n${error.message} `);
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
            error.message = `Error processing quest ${quest.id}:\n${error.message}`;
            throw error;
        }
    }

    // Log problems that were encountered during the fetching or mapping of the quests
    process.stdout.write("\n"); 
    for (const warning of warnings) {
        console.warn('Warning: ' + warning);
    }

    // Sort the quests by level, but with chain quests grouped
    return mapped.sort((a,b) => {
        const aLvl = a.chainStartLvl ? a.chainStartLvl : a.minLevel;
        const bLvl = b.chainStartLvl ? b.chainStartLvl : b.minLevel;
        return aLvl - bLvl || a.chainId - b.chainId || a.chainPosition - b.chainPosition || a.category.localeCompare(b.category);
    })
}

// Write the results to ../data/quests.json
const result = await mapQuests();
await writeFile(
    path.join(import.meta.dirname, '..', 'data', 'quests.json'), 
    JSON.stringify(result));
console.log("Data sucessfully written to quests.json");

const latestVersion = await fetchEndpoint('/version/data');
await writeFile(
    path.join(import.meta.dirname, '..', 'data', 'version.txt'), 
    latestVersion.toString());
console.log("Latest version written to version.txt");