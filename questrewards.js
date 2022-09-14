const fetch = require('node-fetch');

const fetchUrl = async (url) => {
    const delay = new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay per request to not overload API
    await delay;
    const raw = await fetch(url);
    return await raw.json();
};

const getAllQuests = async () => {
    const allQuestsList =  await fetchUrl('https://api.flyff.com/quest');

    const allQuests = [];
    for (const questId of allQuestsList) {
        const quest = await fetchUrl('https://api.flyff.com/quest/' + questId);
        allQuests.push(quest);
    }

    // Add parent & grandparent properties to the list, to show those in the table too
    for (const quest of allQuests) {
        if (quest.parent != null) {
            const parent = allQuests.find(q => q.id == quest.parent);
            const parentName = parent.name.en;

            if (parent.parent != null && !['1st Job Change','2nd Job Change','P.K'].includes(parentName)) {
                const grandparent = allQuests.find(q => q.id == parent.parent);

                quest.parentName = parentName;
                quest.grandparentId = grandparent.id;
                quest.grandparentName = grandparent.name.en;
            }
        }
    }

    // Only return the actual quests, not the parents/categories of quests
    return allQuests.filter(q => q.parentName);
    // await fs.writeFile('questsTemp.json', JSON.stringify(allQuests.filter(q => !q.parentName)));
};

const getQuestRewards = async () => {
    const allQuests = await getAllQuests();
    // const allQuests = JSON.parse(await fs.readFile('questsTemp.json','utf8'));
    
    // First, define the different quest chains. This will help us to sort the quests properly
    const allQuestsRewards = [];
    const chains = [];

    for (const startQuest of allQuests.filter(q => q.type == 'chain' && !q.beginQuests)) {
        chains.push([startQuest.id]);
    }

    for (const chain of chains) {
        let i = 0;
        let nextQuest;
        do {
            nextQuest = allQuests.find(q => q.beginQuests && q.beginQuests[0].quest == chain[i]);
            if (nextQuest) chain.push(nextQuest.id);
            i++;
        } while (nextQuest)
    }

    // Second, add them all to the new array with the needed properties
    for (const quest of allQuests) {
        let category;
        let chainId;
        let chainPosition;
        let chainStartLvl;
        if (quest.type == 'chain') {
            category = 'Chain'
            const chain = chains.find(c => c.includes(quest.id));
            chainId = chains.indexOf(chain);
            chainPosition = chain.indexOf(quest.id);
            chainStartLvl = allQuests.find(q => q.id == chain[0]).minLevel;
        } else {
            category = quest.grandparentName;
        }
        
        // Only add real item rewards (not the quest items you get from a part of a quest)
        const items = []
        if (quest.endReceiveItems != null) {
            for (const item of quest.endReceiveItems) {
                // Check if the item is collected again in an other quest
                if (!allQuests.find(q => q.endRemoveItems && q.endRemoveItems.find(i => i.item == item.item))) {
                    const itemInfo = await fetchUrl('https://api.flyff.com/item/' + item.item);
                    items.push({
                        ...item,
                        name: itemInfo.name.en
                    });
                }
            }
        }

        const startNpcName = (await fetchUrl('https://api.flyff.com/npc/' + quest.beginNPC)).name.en
    
        allQuestsRewards.push({
            id: quest.id,
            category: category,
            name: quest.name.en,
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
            inventorySlots: quest.endReceiveInventorySpaces
        });
    }

    return allQuestsRewards.sort((a,b) => {
        const aLvl = a.chainStartLvl ? a.chainStartLvl : a.minLevel;
        const bLvl = b.chainStartLvl ? b.chainStartLvl : b.minLevel;
        return aLvl - bLvl || a.chainId - b.chainId || a.chainPosition - b.chainPosition || a.category.localeCompare(b.category);
    })
}

module.exports = getQuestRewards




