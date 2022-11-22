let questRewards = []
const headers = document.querySelectorAll('th');
let sortBy = null;
const lvlSelector = document.querySelector('select');
let darkTheme = false;
const themeSwitch = document.getElementById('switch');

const sortQuestRewards = () => {
    if (!sortBy)
        return questRewards;
    else {
        const questRewardsSorted = [...questRewards]

        switch (sortBy) {
            case 'category': questRewardsSorted.sort((a,b) => a.category.localeCompare(b.category)); break;
            case 'part-of': 
                questRewardsSorted.sort((a,b) => {
                    if (a.chainStartLvl && b.chainStartLvl) return a.chainStartLvl - b.chainStartLvl;
                    else if (a.chainStartLvl) return -1;
                    else if (b.chainStartLvl) return 1;
                    else return 0;
                });
                break;
            case 'quest-name': questRewardsSorted.sort((a,b) => a.name.localeCompare(b.name)); break;
            case 'start-npc': 
                questRewardsSorted.sort((a,b) => a.startNpcName.replace(/\[|\]/g, '').localeCompare(b.startNpcName.replace(/\[|\]/g, '')));
                break;
            case 'min-lvl': questRewardsSorted.sort((a,b) => a.minLevel - b.minLevel); break;
            case 'exp-min-lvl': 
                questRewardsSorted.sort((a,b) => {
                    if (a.exp && b.exp) return b.exp[b.minLevel - 1] - a.exp[a.minLevel - 1];
                    else if (a.exp) return -1;
                    else if (b.exp) return 1;
                    else return 0;
                });
                break;
            case 'exp-selected-lvl':
                if (lvlSelector.value != '-') {
                    questRewardsSorted.sort((a,b) => {
                        if (a.exp && b.exp) return b.exp[lvlSelector.value - 1] - a.exp[lvlSelector.value - 1]
                        else if (a.exp) return -1;
                        else if (b.exp) return 1;
                        else return 0;
                    });
                }
                break;
            case 'penya': 
                questRewardsSorted.sort((a,b) => {
                    if (a.penya && b.penya) return b.penya - a.penya;
                    else if (a.penya) return -1;
                    else if (b.penya) return 1;
                    else return 0;
                }); 
                break;
            case 'items': questRewardsSorted.sort((a,b) => {
                    if (a.items.length && b.items.length) return a.items[0].name.localeCompare(b.items[0].name);
                    else if (a.items.length) return -1;
                    else if (b.items.length) return 1;
                    else return 0;
                });
                break;
            case 'inventory-slots': questRewardsSorted.sort((a,b) => {
                    if (a.inventorySlots && b.inventorySlots) return b.inventorySlots - a.inventorySlots;
                    else if (a.inventorySlots) return -1;
                    else if (b.inventorySlots) return 1
                    else return 0;
                });
                break;
            default: break;
        }
    
        return questRewardsSorted;
    }
}

const buildHtmlTable = () => {
    const htmlRows = [];

    for (const quest of sortQuestRewards(sortBy)) {
        const row = [];
        
        // Category
        row[0] = quest.category.charAt(0).toUpperCase() + quest.category.slice(1);
        
        // Part of
        if (quest.category == 'Chain') {
            row[1] = '<a href="https://flyffipedia.com/quests/details/' + quest.parentId + '" rel="external nofollow" target="_blank">' + 
                quest.parentName + '</a> - chain that starts at lvl ' + quest.chainStartLvl;
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
                if (item.soulLinked)
                    itemHtml += ' (Soul-linked)';
                if (i < quest.items.length - 1)
                    itemHtml += '<br>';
            });
            row[8] = itemHtml;
        }

        // Inventory slots
        row[9] = quest.inventorySlots;
    
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

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        darkTheme = true;
        document.body.classList.add("dark");
    }
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme !== null && savedTheme == "dark") {
        darkTheme = true;
        document.body.classList.add("dark");
    }

    const resDataVersion = await fetch('/data/version');
    const resQuestRewards = await fetch('/data');
    if (resDataVersion.ok && resQuestRewards.ok) {
        document.getElementById('data-version').innerHTML = await resDataVersion.json();
        questRewards = await resQuestRewards.json();
        
        fillLvlSelector(questRewards[0].exp.length)
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

