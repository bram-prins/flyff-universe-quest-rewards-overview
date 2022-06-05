const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs/promises');

const fetchUrl = async (url) => {
    const delay = new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay per request to not overload API
    await delay;
    const raw = await fetch(url);
    return await raw.json();
};

const getAllQuests = async () => {
    const allQuestsList =  await fetchUrl('https://flyff-api.sniegu.fr/quest');

    const quests = [];
    for (const questId of allQuestsList) {
        const quest = await fetchUrl('https://flyff-api.sniegu.fr/quest/' + questId);

        // Only add the real quests to the list, not the parents/categories of the quests
        let parentName;
        let grandparentId;
        let grandparentName;
        if (quest.parent != null) {
            const parent = await fetchUrl('https://flyff-api.sniegu.fr/quest/' + quest.parent);
            parentName = parent.name.en;

            if (parent.parent != null && !['1st Job Change','2nd Job Change','P.K'].includes(parentName)) {
                const grandparent = await fetchUrl('https://flyff-api.sniegu.fr/quest/' + parent.parent);
                grandparentId = grandparent.id;
                grandparentName = grandparent.name.en;

                quests.push({
                    ...quest,
                    parentName,
                    grandparentId,
                    grandparentName
                });
            }
        }
    }
    // await fs.writeFile('questsTemp.json', JSON.stringify(quests));
    return quests;
};

const getQuestsRewards = async () => {
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
        let type;
        let chainId;
        let chainPosition;
        let chainStartLvl;
        if (quest.type == 'chain') {
            type = 'Chain';
            const chain = chains.find(c => c.includes(quest.id));
            chainId = chains.indexOf(chain);
            chainPosition = chain.indexOf(quest.id);
            chainStartLvl = allQuests.find(q => q.id == chain[0]).minLevel;
        } else {
            type = quest.grandparentName;
        }
        
        // Only add real item rewards (not the quest items you get from a part of a quest)
        const rewardItems = [];
        if (quest.endReceiveItems != null) {
            for (const rewardItem of quest.endReceiveItems) {
                const itemInfo = await fetchUrl('https://flyff-api.sniegu.fr/item/' + rewardItem.item);
                if (itemInfo.category != 'quest' && itemInfo.category != 'blinkwing') {
                    rewardItems.push({
                        ...rewardItem,
                        name: itemInfo.name.en
                    });
                }
            }
        }
    
        allQuestsRewards.push({
            id: quest.id,
            type,
            name: quest.name.en,
            minLevel: quest.minLevel,
            parentId: quest.parent,
            parentName: quest.type == 'chain' ? quest.parentName : '',
            chainId,
            chainStartLvl,
            chainPosition,
            rewardPenya: quest.endReceiveGold,
            rewardExp: quest.endReceiveExperience,
            rewardItems: rewardItems,
            rewardInventorySpaces: quest.endReceiveInventorySpaces
        });
    }

    return allQuestsRewards.sort((a,b) => {
        const aLvl = a.chainStartLvl ? a.chainStartLvl : a.minLevel;
        const bLvl = b.chainStartLvl ? b.chainStartLvl : b.minLevel;
        return aLvl - bLvl || a.chainId - b.chainId || a.chainPosition - b.chainPosition || a.type.localeCompare(b.type);
    })
}

const htmlTableData = async () => {
    const allQuestsRewards = await getQuestsRewards();
    
    // Create the inner html for all the rows of the html table
    const htmlData = []
    for (const quest of allQuestsRewards) {
        const columns = [];
        columns[0] = quest.type;
        if (quest.type == 'Chain') {
            columns[1] = '<a href="https://flyffipedia.com/quests/details/' + quest.parentId + '" target="_blank">' + quest.parentName + 
                '</a> - chain that starts at lvl ' + quest.chainStartLvl;
            if (quest.chainPosition == 0)
                columns[1] += ' (start quest)'
        }
        columns[2] = '<a href="https://flyffipedia.com/quests/details/' + quest.id + '" target="_blank">' +  quest.name + '</a>';
        columns[3] = quest.minLevel;
        if (quest.rewardExp != null)
            columns[4] = quest.rewardExp[quest.minLevel - 1].toString() + '%';
        if (quest.rewardPenya != null )
            columns[5] = quest.rewardPenya.toLocaleString();
        if (quest.rewardItems != null) {
            let rewardItemHtml = '';
            quest.rewardItems.forEach((item, i) => {
                rewardItemHtml += item.count + 'x <a href="https://flyffipedia.com/items/details/' + item.item + '" target="_blank">' + item.name + '</a>';
                if (item.soulLinked)
                    rewardItemHtml += ' (Soul-linked)';
                if (i < quest.rewardItems.length - 1)
                    rewardItemHtml += '<br>';
            }) ;
            columns[6] = rewardItemHtml;
        }
        columns[7] = quest.rewardInventorySpaces;

        htmlData.push(columns);
    }

    // Write the rows as html
    let htmlTableRows = '';
    for (const row of htmlData) {
        htmlTableRows += '<tr>\n';
        for (const column of row) {
            htmlTableRows += '<td>' + (column || '-') + '</td>\n';
        }
        htmlTableRows += '</tr>\n';
    }

    return htmlTableRows;
}

// Build index.html
const writeHtml = async (gameDataVersion) => {
    const tableData = await htmlTableData();
    await fs.writeFile(path.join(__dirname + '/index.html'),
`<!DOCTYPE html>
<html>
<head>
<title>Flyff Universe quest rewards overview</title>
<style>
table {
  border-collapse: collapse;
  width: 100%;
}
td, th {
  border: 1px solid black;
  text-align: left;
  padding: 8px;
}
tr:nth-child(even) {
  background-color: whitesmoke;
}
</style>
</head>
<body>
<h2>Flyff Universe quest rewards overview</h2>
<p>
Game data v. ${gameDataVersion}<br>
Job change and PK quests are not listed
</p>
<table>
<tr>
<th>Type</th>
<th>Part of</th>
<th>Quest Name</td>
<th>Min. Lvl</td>
<th>Exp. (at min. lvl)</th>
<th>Penya</th>
<th>Item(s)</th>
<th>Inventory Slots</th>
</tr>
${tableData}
</table>
<p><a href="https://github.com/bram-prins/flyff-universe-quest-rewards-overview">GitHub</a></p>
</body>
</html>
`);
};

//writeHtml('6')
module.exports = writeHtml;
