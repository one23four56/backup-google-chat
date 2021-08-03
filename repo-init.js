const fs = require('fs');
const { exec } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

fs.writeFileSync('messages.json', '{"messages":[]}', 'utf8');
fs.writeFileSync('webhooks.json', '[]', 'utf8');
fs.writeFileSync('auths.json', '{}', 'utf8');

rl.question('Enter email address: ', email => {
    rl.question('Enter email password: ', password => {
        fs.writeFileSync('.env', `EMAIL_PASS=${password}\nEMAIL=${email}`);
    });
});

exec('npm run build', (a, b, c) => {});