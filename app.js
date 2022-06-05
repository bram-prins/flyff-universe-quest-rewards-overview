const http = require('http');
const fetch = require('node-fetch');
const writeHtml = require('index.js');
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
let currentVersion = 6
const checkGameDataVersion = async () => {
    const gameDataVersion = await (await fetch('https://flyff-api.sniegu.fr/version/data')).json();
    if (currentVersion != gameDataVersion) {
        writeHtml(gameDataVersion);
        currentVersion = gameDataVersion;
    }
}

// Check game data version every night at 1 am
const reset = async () => {
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // For the next day, ...
        3, 0, 0 // ...at 01:00:00 hours
    );
    const ms = night.getTime() - now.getTime();

    setTimeout(() => {
        await checkGameDataVersion();
        console.debug('Game data version up to date; reset')
        await reset();
    }, ms);
}
reset();

