import * as readline from 'readline';
import { Users, User } from '../modules/users';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function addUser() {
    rl.question("Name: ", name => {
        rl.question("Email: ", email => {
            rl.question("Image: ", image => {
                const user = new User(name, email, image)
                console.log(user.getAsUserData())
                rl.question("Confirm (y/n) ", confirm => {
                    if (confirm === "y" || confirm === "Y") {
                        Users.addUser(user);
                        rl.question("Continue (y/n)", cont => {
                            if (cont === "y" || cont === "Y")
                                addUser();
                            else console.log("Press Ctrl+C to Exit")
                        })
                    } else addUser();
                })
            })
        })
    })
}


addUser();