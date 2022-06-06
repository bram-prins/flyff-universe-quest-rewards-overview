const http = require('http');
const fetch = require('node-fetch');
const writeHtml = require('./index.js');
const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
app.use(express.json());
app.use(express.static("express"));

// Default URL for website
app.use('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
});

// Open server
const server = http.createServer(app);
const port = process.env.PORT || 3000;
server.listen(port);
console.debug('Server listening on port ' + port);

// Get latest game data version and update if needed
const checkDataVersion = async () => {
    const currentDataVersion = await fs.readFile(path.join(__dirname + '/dataversion.txt'))
    const latestDataVersion = await (await fetch('https://flyff-api.sniegu.fr/version/data')).json();
    if (currentDataVersion != latestDataVersion) {
        console.debug('Updating webpage');
        await writeHtml(latestDataVersion);
        await fs.writeFile(path.join(__dirname + '/dataversion.txt'), latestDataVersion.toString())
    }
    console.debug('Game data up to date');
}
checkDataVersion();

