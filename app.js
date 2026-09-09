import fetch from 'node-fetch';
import getQuestData from './questclient.js';
import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile, writeFile } from 'fs/promises';
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static('public'));

let currentVersion = null;
let latestVersion = null;
app.use('/data/version', (req, res) => {
    if (currentVersion)
        res.send(currentVersion.toString());
    else
        res.sendStatus(503); // Unavailable
});

let updating = false;
app.use('/data', (req, res) => {
    if (!updating)
        res.sendFile(join(__dirname + '/data/quests.json'));
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
    try {
        currentVersion = await readFile(join(__dirname + '/data/version.txt'));
    } catch (error) {
        console.warn('No current version found.');
    }

    try {
        const response  = await fetch('https://api.flyff.com/version/data');
        latestVersion = await response.json();
    } catch (error) {
        if (currentVersion == null) {
            throw new Error('Error fetching latest data version, and no existing data version exists. ' + error);
        }
    }
    
    if (currentVersion != latestVersion) {
        console.debug('Updating data...');
        const questRewardsData = await getQuestData();
        // Write the data to our local file; temporarily set updating to true so that a 503 is returned when the webpage tries to access it
        updating = true;
        await writeFile(join(__dirname + '/data/quests.json'), JSON.stringify(questRewardsData));
        await writeFile(join(__dirname + '/data/version.txt'), latestVersion.toString());
        currentVersion = latestVersion;
        updating = false;
    }
    console.debug('Game data is up to date');
}
checkDataVersion();




