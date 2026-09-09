let quests = []
const headers = document.querySelectorAll('th');
let sortBy = null;
const lvlSelector = document.querySelector('select');
let darkTheme = false;
const themeSwitch = document.getElementById('switch');
const completedQuestsStorageKey = 'completedQuests';

const getCompletedQuestIds = () => {
    const savedQuests = localStorage.getItem(completedQuestsStorageKey);
    if (!savedQuests)
        return [];

    const completedQuestIds = JSON.parse(savedQuests);
    return Array.isArray(completedQuestIds) ? completedQuestIds : [];
}

const saveCompletedQuestIds = completedQuestIds => localStorage.setItem(completedQuestsStorageKey, JSON.stringify(completedQuestIds));

const sortQuests = () => {
    if (!sortBy)
        return quests;
    else {
        const questsSorted = [...quests]

        switch (sortBy) {
            case 'category': 
                questsSorted.sort((a,b) => a.category.localeCompare(b.category)); 
                break;
            case 'part-of': 
                questsSorted.sort((a,b) => {
                    if (a.chainStartLvl && b.chainStartLvl) return a.chainStartLvl - b.chainStartLvl;
                    else if (a.chainStartLvl) return -1;
                    else if (b.chainStartLvl) return 1;
                    else return 0;
                });
                break;
            case 'quest-name': 
                questsSorted.sort((a,b) => a.name.localeCompare(b.name)); 
                break;
            case 'start-npc': 
                questsSorted.sort((a,b) => a.startNpcName.replace(/\[|\]/g, '').localeCompare(b.startNpcName.replace(/\[|\]/g, '')));
                break;
            case 'min-lvl': 
                questsSorted.sort((a,b) => a.minLevel - b.minLevel); 
                break;
            case 'exp-min-lvl': 
                questsSorted.sort((a,b) => {
                    if (a.exp && b.exp) return b.exp[b.minLevel - 1] - a.exp[a.minLevel - 1];
                    else if (a.exp) return -1;
                    else if (b.exp) return 1;
                    else return 0;
                });
                break;
            case 'exp-selected-lvl':
                if (lvlSelector.value != '-') {
                    questsSorted.sort((a,b) => {
                        if (a.exp && b.exp) return b.exp[lvlSelector.value - 1] - a.exp[lvlSelector.value - 1]
                        else if (a.exp) return -1;
                        else if (b.exp) return 1;
                        else return 0;
                    });
                }
                break;
            case 'penya': 
                questsSorted.sort((a,b) => {
                    if (a.penya && b.penya) return b.penya - a.penya;
                    else if (a.penya) return -1;
                    else if (b.penya) return 1;
                    else return 0;
                }); 
                break;
            case 'items': 
                questsSorted.sort((a,b) => {
                    if (a.items.length && b.items.length) return a.items[0].name.localeCompare(b.items[0].name);
                    else if (a.items.length) return -1;
                    else if (b.items.length) return 1;
                    else return 0;
                });
                break;
            case 'inventory-slots': 
                questsSorted.sort((a,b) => {
                    if (a.inventorySlots && b.inventorySlots) return b.inventorySlots - a.inventorySlots;
                    else if (a.inventorySlots) return -1;
                    else if (b.inventorySlots) return 1
                    else return 0;
                });
                break;
            case 'completed': 
                const completedQuestIds = getCompletedQuestIds();
                questsSorted.sort((a,b) => Number(completedQuestIds.includes(b.id)) - Number(completedQuestIds.includes(a.id)));
                break;
            default: break;
        }
    
        return questsSorted;
    }
}

const buildHtmlTable = () => {
    const htmlRows = [];
    const completedQuestIds = getCompletedQuestIds();

    for (const quest of sortQuests(sortBy)) {
        const row = [];
        
        // Category
        row[0] = quest.category.charAt(0).toUpperCase() + quest.category.slice(1);
        
        // Part of
        if (quest.category == 'Chain') {
            row[1] = '<a href="https://flyffipedia.com/quests/details/' + quest.parentId + '" rel="external nofollow" target="_blank">' + 
                quest.parentName + '</a> - chain from lvl ' + quest.chainStartLvl;
            if (quest.chainPosition == 0)
                row[1] += ' (start quest)'
        }

        // Quest Name
        row[2] = '<a href="https://flyffipedia.com/quests/details/' + quest.id + '" rel="external nofollow" target="_blank">' +  quest.name + '</a>';
        
        // Start NPC
        row[3] = '<a href="https://flyffipedia.com/npcs/details/' + quest.startNpc + '" rel="external nofollow" target="_blank">' + quest.startNpcName + '</a>';
        
        // Min. lvl
        row[4] = quest.minLevel;

        // Exp. at min. lvl
        if (quest.exp) {
            row[5] = quest.exp[quest.minLevel - 1].toString() + '%';
            // Exp at selected lvl
            if (lvlSelector.value != '-') {
                if (lvlSelector.value < quest.minLevel)
                    row[6] = '-'
                else
                    row[6] = (Math.round(quest.exp[lvlSelector.value - 1] * 100) / 100).toString() + '%';
            }
        }

        // Penya
        if (quest.penya)
            row[7] = quest.penya.toLocaleString();
        
        // Item(s)
        if (quest.items) {
            let itemHtml = '';
            quest.items.forEach((item, i) => {
                itemHtml += item.count + 'x <a href="https:\/\/flyffipedia.com/items/details/' + item.item + 
                    '" rel="external nofollow" target="_blank">' + item.name + '</a>';
                if (item.upgradeLevel)
                    itemHtml += ` +${item.upgradeLevel}`
                if (item.soulLinked)
                    itemHtml += ' (Soul-linked)';
                if (i < quest.items.length - 1)
                    itemHtml += '<br>';
            });
            row[8] = itemHtml;
        }

        // Inventory slots
        row[9] = quest.inventorySlots;

        // Completed checkbox
        if (!quest.repeatable && quest.category != 'Daily') {
            const isCompleted = completedQuestIds.includes(quest.id);
            row[10] = `<input type="checkbox" class="completed-checkbox" data-id="${quest.id}" ${isCompleted ? 'checked' : ''}>`;
        } else {
            row[10] = '-';
        }

        htmlRows.push(row);
    }

    // Concatenate htmlRows
    let html = '\n';
    for (const row of htmlRows) {
        html += '\t\t\t<tr>\n';
        for (const value of row) {
            html += '\t\t\t\t<td>' + (value || '-') + '</td>\n';
        }
        html += '\t\t\t</tr>\n';
    }

    // Append the html to table body
    document.querySelector('tbody').innerHTML = html;

    document.querySelectorAll('.completed-checkbox').forEach(checkbox => {
        checkbox.onchange = event => {
            const questId = Number(event.target.dataset.id);
            const completedQuestIds = getCompletedQuestIds();
            const questIndex = completedQuestIds.indexOf(questId);

            if (event.target.checked && questIndex === -1)
                completedQuestIds.push(questId);
            else if (!event.target.checked && questIndex !== -1)
                completedQuestIds.splice(questIndex, 1);

            saveCompletedQuestIds(completedQuestIds);
        }
    });

    // Set the color of this column to lightblue, to indicate the sort
    let header;
    for (let i = 0; i < headers.length; i++) {
        if (headers[i].id == sortBy) {
            header = headers[i];
            header.style.backgroundColor = 'rgb(0,0,0,0.08)';
            const cellsInColumn = document.querySelectorAll(`td:nth-child(${i + 1})`);
            for (let j = 0; j < cellsInColumn.length; j++)
                cellsInColumn[j].style.backgroundColor = 'rgb(0,0,0,0.08)';
        } else {
            headers[i].removeAttribute('style');
        }
    }
}

// Append options 1-140 to the level selector
const fillLvlSelector = amtOfLvls => {
    for (const i of Array.from({length: amtOfLvls}, (_, i) => i + 1)) {
        const option = document.createElement('option');
        option.innerHTML = i.toString();
        lvlSelector.appendChild(option);
    }
}

const setTheme = dark => {
    darkTheme = !darkTheme;
    if (dark) {
        document.body.classList.add("dark");
        localStorage.setItem("theme", "dark");
    } else {
        document.body.classList.remove("dark");
        localStorage.setItem("theme", "light");
    }
}


// At initialization of the page, load the html table
const init = async () => {
    themeSwitch.onclick = () => setTheme(!darkTheme);

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        darkTheme = true;
        document.body.classList.add("dark");
    }
    if (savedTheme !== null && savedTheme == "dark") {
        darkTheme = true;
        document.body.classList.add("dark");
    }

    const resDataVersion = await fetch('/data/version');
    const resQuests = await fetch('/data');
    if (resDataVersion.ok && resQuests.ok) {
        document.getElementById('data-version').innerHTML = await resDataVersion.json();
        quests = await resQuests.json();
        
        fillLvlSelector(quests[0].exp.length)
        buildHtmlTable()

        for (let i = 0; i < headers.length; i++) {
            headers[i].onclick = event => {
                if (event.target.tagName != 'SELECT' && event.target.tagName != 'OPTION') {
                    if (headers[i].id == sortBy)
                        sortBy = null;
                    else
                        sortBy = headers[i].id
                    buildHtmlTable();
                }
            }
        }

        lvlSelector.onchange = () => buildHtmlTable();
    } else {
        alert('The application is currently updating the data, choose OK to retry.');
        init();
    }
}

init();

