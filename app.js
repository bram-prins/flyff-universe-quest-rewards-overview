const http = require('http');
const fetch = require('node-fetch');
const writeHtml = require('./index.js');
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static("express"));

// Default URL for website
app.use('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
});

// Open server
const server = http.createServer(app);
const port = 3000;
server.listen(port);
console.debug('Server listening on port ' + port);

// Get latest game data version and update if needed
let currentVersion = '6'
const checkGameDataVersion = async () => {
    const gameDataVersion = await (await fetch('https://flyff-api.sniegu.fr/version/data')).json();
    if (currentVersion != gameDataVersion) {
        writeHtml(gameDataVersion);
        currentVersion = gameDataVersion;
    }
}

// Check game data version every night at 1 am
const reset = () => {
    const now = new Date();
    const next = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // For the next day, ...
        1, 0, 0 // ...at 01:00:00 hours
    );
    const ms = next.getTime() - now.getTime();

    setTimeout(async () => {
        await checkGameDataVersion();
        console.debug('Game data version up to date; reset')
        reset();
    }, ms);
}
reset();

