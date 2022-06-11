const fetch = require('node-fetch');
const getQuestRewardsData = require('./questrewards.js');
const express = require('express');
const path = require('path');
const fs = require('fs/promises');

// Get latest game data version and update our data if needed
const checkDataVersion = async () => {
    const currentVersion = await fs.readFile(path.join(__dirname + '/data/dataversion.txt'))
    const latestVersion = await (await fetch('https://flyff-api.sniegu.fr/version/data')).json();
    if (currentVersion != latestVersion) {
        console.debug('Updating webpage');
        const questRewardsData = await getQuestRewardsData();
        await fs.writeFile(path.join(__dirname + '/data/questrewards.json'), JSON.stringify(questRewardsData))
        await fs.writeFile(path.join(__dirname + '/data/dataversion.txt'), latestVersion.toString())
    }
    console.debug('Game data up to date');
}

const app = express();
app.use(express.static('public'));
app.use('/data', express.static('data'));

const port = process.env.PORT || 3000;
const startServer = async () => {
    await checkDataVersion();
    app.listen(port, () => console.debug('Server started on port ' + port));
}
startServer();




