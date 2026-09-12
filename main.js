const completedQuestsStorageKey = 'completedQuests';
let sortBy = null;
let quests;
let lvlSelector;

init();
async function init() {
    initTheme();
    await initData();
    initHeaders();
    buildTable();
}


/**
 * Gets the data from the data folder
 */
async function initData() {
    const dataVersionResponse = await fetch('./data/version.txt');
    if (dataVersionResponse.ok) {
        document.getElementById('data-version').innerHTML = await dataVersionResponse.text();
    }

    const questsResponse = await fetch('./data/quests.json');
    if (!questsResponse.ok) {
        alert("Failed to load quest data. Please try again later.");
    }

    quests = await questsResponse.json();
}


/**
 * Initializes the theme (dark or light), and the theme switch functionality on the top of the page
 */
function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add("dark");
    }
    if (savedTheme !== null && savedTheme == "dark") {
        document.body.classList.add("dark");
    }

    const themeSwitch = document.getElementById('switch');
    themeSwitch.onclick = () => {
        if (document.body.classList.contains("dark")) {
            document.body.classList.remove("dark");
            localStorage.setItem("theme", "light");

        } else {
            document.body.classList.add("dark");
            localStorage.setItem("theme", "dark");
        }
    };
}


/**
 * Adds necessary logic for the table headers:
 * - Fills the level selector in the "Exp. at level:" header
 * - Add event listeners to the headers of the table to rebuild the table with chosen sorting
 */
function initHeaders() {
    // Fill the lvl selector in the Exp. at level: header, and add an event listener
    lvlSelector = document.querySelector('th select');

    const amountOfLevels = quests[0].exp.length;
    for (const i of Array.from({length: amountOfLevels}, (_, i) => i + 1)) {
        const option = document.createElement('option');
        option.innerHTML = i.toString();
        lvlSelector.appendChild(option);
    }

    lvlSelector.onchange = () => buildTable();

    // Add event listeners to the headers of the table to rebuild the table with chosen sorting
    const headers = document.querySelectorAll('th');
    [...headers].forEach((header, i) => {
        header.onclick = (event) => {
            if (event.target.tagName != 'SELECT' && event.target.tagName != 'OPTION') {
                if (header.id != sortBy)
                    sortBy = header.id;
                else
                    sortBy = null;

                buildTable();

                if (sortBy != null) {
                    const highlightColor = document.body.classList.contains("dark") ? 'rgb(0,0,0,0.25)': 'rgb(0,0,0,0.08)'
                    header.style.backgroundColor = highlightColor;
                    const cellsInColumn = document.querySelectorAll(`td:nth-child(${i + 1})`);
                    for (let j = 0; j < cellsInColumn.length; j++)
                        cellsInColumn[j].style.backgroundColor = highlightColor;
                } else {
                    header.removeAttribute('style');
                }
            }
        }
    });
}


/**
 * Builds and fills the HTML table with the data
 */
function buildTable() {
    const htmlRows = [];
    const completedQuestIds = getCompletedQuestIds();

    for (const quest of sortQuests()) {
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

        if (quest.exp) {
            // Exp. at min. lvl
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

    // Concatenate htmlRows with correct indentation
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

    // Add some event listeners
    // - Add event listeners to the progress checkboxes to store it in the browser's local storage
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
}
   


/**
 * Get completed quest IDs from browser's local storage
 * @returns {array} Array of quest id's
 */
function getCompletedQuestIds() {
    const savedQuests = localStorage.getItem(completedQuestsStorageKey);
    if (!savedQuests)
        return [];

    return JSON.parse(savedQuests) ?? [];
}

/**
 * Store the checked quest id's in the browser's local storage
 * @param {array} completedQuestIds Array of quest id's
 */
function saveCompletedQuestIds(completedQuestIds) {
    localStorage.setItem(completedQuestsStorageKey, JSON.stringify(completedQuestIds));
}


/**
 * Sorts quest by the given table column header ID, @see sortBy
 * @returns {array} Sorted quests
 */
function sortQuests() {
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