const socket = io();

const setHeader = text => document.getElementById("header").innerText = text

window.alert = (text) => {
    document.getElementById("alert").style.display = "block"
    document.getElementById("alert").innerText = text;
}

function setCookie(name, value, ex_days) {
    let ex_date = new Date();
    ex_date.setTime(ex_date.getTime() + (ex_days*24*60*60*1000));
    let expires = "expires="+ ex_date.toUTCString();
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax;Secure;SameParty;}`
}

document.getElementById("email-form").addEventListener('submit', (event)=>{
    event.preventDefault()
    document.querySelector("holder").appendChild(document.getElementById("email-form"))
    setHeader("Please Wait...")
    let formdata = new FormData(document.getElementById("email-form"))
    socket.emit('sign-in', formdata.get('email'), (response) => {
        switch (response) {
            case "bad-email":
                setHeader("Error")
                alert('The email you entered is not on our database. Please check for typos and try again using all lowercase letters, and if that does not work, contact me.');
                document.querySelector("#holder").appendChild(document.getElementById("reload"))
                break;
            case "set-password":
                setHeader("Set Your Password")
                document.querySelector("#holder").appendChild(document.getElementById("set-password-form"))
                document.getElementById("set-password-form").addEventListener('submit', event=>{
                    event.preventDefault()
                    const setPasswordFormData = new FormData(document.getElementById('set-password-form'))
                    if (setPasswordFormData.get("input-password") !== setPasswordFormData.get("confirm-password")) {document.getElementById('confirm-password').setCustomValidity("Passwords do not match.");return}
                    socket.emit("set-password", {password: setPasswordFormData.get('input-password'), code: setPasswordFormData.get('confirm')}, (setPasswordResponse, data)=>{
                        switch (setPasswordResponse) {
                            case "bad-code":
                                setHeader("Error")
                                document.querySelector("holder").appendChild(document.getElementById("set-password-form"))
                                document.querySelector("#holder").appendChild(document.getElementById("reload"))
                                alert("The confirmation code you entered was wrong.")
                                break;
                            case "set-password":
                                setCookie("email", data.email, 30);
                                setCookie("pass", data.pass, 30);
                                location.reload();
                        }
                    })
                })
                break;
            case "give-password":
                setHeader("Enter Your Password")
                document.querySelector("#holder").appendChild(document.getElementById("give-password-form"))
                const passwordSubmitListener = event => {
                    event.preventDefault()
                    const givePasswordFormData = new FormData(document.getElementById("give-password-form"))
                    socket.emit("give-password", { password: givePasswordFormData.get('password') }, (givePasswordResponse, data) => {
                        if (givePasswordResponse !== "correct") {
                            setHeader("Error")
                            document.querySelector("holder").appendChild(document.getElementById("give-password-form"))
                            document.querySelector("#holder").appendChild(document.getElementById("reload"))
                            alert("The password you entered was wrong.")
                            return;
                        }
                        setCookie("email", data.email, 30)
                        setCookie("pass", data.pass, 30)
                        alert("Authentication succeeded")
                        location.reload()
                    })
                }
                document.getElementById("give-password-form").addEventListener('submit', passwordSubmitListener)
                document.getElementById("reset-password").addEventListener('click', e=>{
                    document.getElementById("give-password-form").removeEventListener('submit', passwordSubmitListener)
                    document.querySelector("holder").appendChild(document.getElementById("give-password-form"))
                    setHeader('Please Wait...')
                    socket.emit('give-password', { type: 'reset' }, passwordResetResponse => {
                        if (passwordResetResponse !== 'sent') return;
                        document.querySelector("#holder").appendChild(document.getElementById("reset-password-form"))
                        setHeader("Reset Your Password")
                        document.getElementById("reset-password-form").addEventListener('submit', event=>{
                            event.preventDefault()
                            const resetPasswordFormData = new FormData(document.getElementById("reset-password-form"))
                            socket.emit('confirm-password-reset', resetPasswordFormData.get("reset-confirm-code"), confirmResetResponse=>{
                                switch (confirmResetResponse) {
                                    case "bad-code":
                                        setHeader("Error")
                                        document.querySelector("holder").appendChild(document.getElementById("reset-password-form"))
                                        document.querySelector("#holder").appendChild(document.getElementById("reload"))
                                        alert("The confirmation code you entered was wrong.")
                                        break;
                                    case "password-reset":
                                        alert("Your password has been reset.")
                                        location.reload();
                                        break;
                                }
                            })
                        })
                    })
                })
        }
    })
    socket.once('email-sent', _=>{
        
    })
}, {
    once: true
})
