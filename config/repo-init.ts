import * as fs from 'fs';
import { exec } from 'child_process';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

fs.writeFileSync('messages.json', '[]', 'utf8');
fs.writeFileSync('webhooks.json', '[]', 'utf8');
fs.writeFileSync('userAuths.json', '{}', 'utf8');

console.log("A gmail account with less secure apps access turned on is required to run the chat.\nPlease enter login details for that account:");
rl.question('Enter email address: ', email => {
    rl.question('Enter email password: ', password => {
        fs.writeFileSync('.env', `EMAIL_PASS=${password}\nEMAIL=${email}`);
        return;
    });
});

exec('npm run build');