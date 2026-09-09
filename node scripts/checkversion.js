import path from 'path';
import { readFile } from 'fs/promises';

// Check the current API data version the site uses from ../data/version.txt
let currentVersion = 0;
try {
    currentVersion = await readFile(path.join(import.meta.dirname, '..', 'data', 'version.txt'));
    console.log('Current version: ' + currentVersion);
} catch {
    console.log('No current version found.');
}

// Fetch the latest available API data version
const latestVersionResponse  = await fetch('https://api.flyff.com/version/data');
if (!latestVersionResponse.ok) 
    throw new Error(`${latestVersionResponse.status}:\n${await latestVersionResponse.text()}`);
const latestVersion = await latestVersionResponse.json();
console.log('Latest version: ' + latestVersion);

// Log if an update is available
if (currentVersion == latestVersion) {
    console.log('Game data is up to date');
} else {
    console.log('Update available. Run "node updatedata.js" to update the data');
}