import * as readline from 'readline';
import * as fs from 'fs';
import * as uuid from 'uuid'
import { UserData } from '../ts/lib/authdata'
import * as json from '../ts/modules/json'

class User {
    email: string;
    name: string;
    id: string;
    img: string;

    /**
     * Creates a new user. Use the addUser method of the {@link Users} class to add to the users json.
     * @param name Name of the user
     * @param email Email of the user
     * @param img Image of the user
     */
    constructor(name: string, email: string, img: string) {
        this.name = name
        this.email = email
        this.img = img;

        this.id = uuid.v4()
    }

    /**
     * Returns the user data for this user as a UserData object
     * @returns The user data for this user, as a UserData object
     */
    getAsUserData(): UserData {
        return {
            email: this.email,
            name: this.name,
            id: this.id,
            img: this.img
        }
    }

    /**
     * Adds a user to the users json
     * @param {User} user User to add to users json
     */
    static addUser(user: User) {
        const users: Record<string, UserData> = json.read("users.json", true, "{}");

        users[user.id] = user.getAsUserData();

        json.write("users.json", users);
    }

}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function addUser() {
    rl.question("Name: ", name => {
        rl.question("Email: ", email => {
            rl.question("Image: ", image => {
                const user = new User(name, email, image)
                console.table(user.getAsUserData())
                rl.question("Confirm (y/n) ", confirm => {
                    if (confirm === "y" || confirm === "Y") {
                        User.addUser(user);
                        rl.question("Continue (y/n)", cont => {
                            if (cont === "y" || cont === "Y")
                                addUser();
                            else {
                                fs.rmSync('./config/out', {
                                    recursive: true
                                })
                                process.exit();
                            }
                        })
                    } else addUser();
                })
            })
        })
    })
}


addUser();