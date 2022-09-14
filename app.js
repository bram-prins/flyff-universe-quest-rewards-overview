const fetch = require('node-fetch');
const getQuestRewardsData = require('./questrewards.js');
const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
app.use(express.static('public'));
let currentVersion = null;
let updating = false;
app.use('/data/version', (req, res) => {
    if (currentVersion)
        res.send(currentVersion.toString());
    else
        res.sendStatus(503); // Unavailable
});
app.use('/data', (req, res) => {
    if (!updating)
        res.sendFile(path.join(__dirname + '/data/questrewards.json'));
    else
        res.sendStatus(503);
});

const port = process.env.PORT || 3000;
app.listen(port, (error) => {
    if (error)
        console.debug('Error: ' + error);
    else
        console.debug('Server started on port ' + port);
});

// Get latest game data version and update our data if needed
const checkDataVersion = async () => {
    currentVersion = await fs.readFile(path.join(__dirname + '/data/dataversion.txt'));
    const latestVersion = await (await fetch('https://api.flyff.com/version/data')).json();
    if (currentVersion != latestVersion) {
        console.debug('Updating data...');
        const questRewardsData = await getQuestRewardsData();
        // Write the data to our local file; temporarily set updating to true so that a 503 is returned when the webpage tries to access it
        updating = true;
        await fs.writeFile(path.join(__dirname + '/data/questrewards.json'), JSON.stringify(questRewardsData));
        await fs.writeFile(path.join(__dirname + '/data/dataversion.txt'), latestVersion.toString());
        currentVersion = latestVersion;
        updating = false;
    }
    console.debug('Game data is up to date');
}
checkDataVersion();




