const socket = io();

const setHeader = text => id("header").innerText = text

const id = elementID => document.getElementById(elementID)

const q = query => document.querySelector(query)

const badCode = currentForm => {
    setHeader("Error")
    q("holder").appendChild(id(currentForm))
    q("#holder").appendChild(id("reload"))
    alert("The confirmation code you entered was wrong.")
}

const pleaseWait = currentForm => {
    q("holder").appendChild(id(currentForm))
    setHeader('Please Wait...')
}

window.alert = (text) => {
    id("alert").style.display = "block"
    id("alert").innerText = text;
}

function setCookie(name, value, ex_days) {
    let ex_date = new Date();
    ex_date.setTime(ex_date.getTime() + (ex_days * 24 * 60 * 60 * 1000));
    let expires = "expires=" + ex_date.toUTCString();
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax;Secure;SameParty;}`
}

id("email-form").addEventListener('submit', (event) => {
    event.preventDefault()
    pleaseWait("email-form")
    let formdata = new FormData(id("email-form"))
    socket.emit('sign-in', formdata.get('email'), (response) => {
        switch (response) {
            case "bad-email":
                setHeader("Error")
                alert('The email you entered is not on our database. Please check for typos and try again using all lowercase letters, and if that does not work, contact me.');
                q("#holder").appendChild(id("reload"))
                break;
            case "set-password":
                setHeader("Set Your Password")
                q("#holder").appendChild(id("set-password-form"))
                id("set-password-form").addEventListener('submit', event => {
                    event.preventDefault()
                    const setPasswordFormData = new FormData(id('set-password-form'))
                    if (setPasswordFormData.get("input-password") !== setPasswordFormData.get("confirm-password")) { id('confirm-password').setCustomValidity("Passwords do not match."); return }
                    socket.emit("set-password", { password: setPasswordFormData.get('input-password'), code: setPasswordFormData.get('confirm') }, (setPasswordResponse, data) => {
                        switch (setPasswordResponse) {
                            case "bad-code":
                                badCode("set-password-form");
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
                q("#holder").appendChild(id("give-password-form"))
                const passwordSubmitListener = event => {
                    event.preventDefault()
                    pleaseWait("give-password-form")
                    const givePasswordFormData = new FormData(id("give-password-form"))
                    socket.emit("give-password", { password: givePasswordFormData.get('password') }, (givePasswordResponse, data) => {
                        if (givePasswordResponse !== "correct") {
                            setHeader("Error")
                            q("holder").appendChild(id("give-password-form"))
                            q("#holder").appendChild(id("reload"))
                            alert("The password you entered was wrong.")
                            return;
                        }
                        setCookie("email", data.email, 30)
                        setCookie("pass", data.pass, 30)
                        setCookie("name", data.name, 30);
                        alert("Authentication succeeded")
                        location.reload()
                    })
                }
                id("give-password-form").addEventListener('submit', passwordSubmitListener)
                id("reset-password").addEventListener('click', e => {
                    id("give-password-form").removeEventListener('submit', passwordSubmitListener)
                    pleaseWait("give-password-form")
                    socket.emit('give-password', { type: 'reset' }, passwordResetResponse => {
                        if (passwordResetResponse !== 'sent') return;
                        q("#holder").appendChild(id("reset-password-form"))
                        setHeader("Reset Your Password")
                        id("reset-password-form").addEventListener('submit', event => {
                            event.preventDefault()
                            const resetPasswordFormData = new FormData(id("reset-password-form"))
                            socket.emit('confirm-password-reset', resetPasswordFormData.get("reset-confirm-code"), confirmResetResponse => {
                                switch (confirmResetResponse) {
                                    case "bad-code":
                                        badCode("reset-password-form");
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
                break;
            case "send-error":
                setHeader("Error")
                alert("Something occurred on our end that interrupted the sending of your email. Please try again and report this to me if it continues.")
        }
    })
    socket.once('email-sent', _ => {

    })
}, {
    once: true
})
