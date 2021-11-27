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
            case "bad_email":
                setHeader("Error")
                alert('The email you entered is not on our database. Please check for typos and try again using all lowercase letters, and if that does not work, contact me.');
                document.querySelector("#holder").appendChild(document.getElementById("reload"))
                break;
            case "sent":
                setHeader("Enter Confirmation Code")
                alert('Email sent. Check your inbox for an email from chat.email.wfb@gmail.com. It may be in your spam folder, so make sure to check there if you don\'t find it.')
                document.querySelector("#holder").appendChild(document.getElementById("confirm-form"))
                document.getElementById("confirm-form").addEventListener('submit', event=>{
                    event.preventDefault()
                    formdata = new FormData(document.getElementById("confirm-form"))
                    socket.emit('confirm-code', formdata.get('confirm'), (response)=>{
                        switch (response.status) {
                            case "auth_done":
                                alert("Authentication succeeded.")
                                setCookie('name', response.data.name, 30)
                                setCookie('mpid', response.data.mpid, 30)
                                setCookie('email', response.data.email, 30)
                                location.reload()
                                break;
                            case "auth_failed":
                            default:
                                setHeader("Authentication Failed")
                                alert("Authentication failed.")
                                document.querySelector("holder").appendChild(document.getElementById("confirm-form"))
                                document.querySelector("#holder").appendChild(document.getElementById("reload"))
                                break;
                        }
                    })
                }, {
                    once: true
                })
                break;
            case "send_err":
            default:
                setHeader("Error")
                alert('An unexpected error occurred during the sending of your email. Please try again and contact me if this persists.')
                document.querySelector("#holder").appendChild(document.getElementById("reload"))
                break;
        }
    })
    socket.once('email-sent', _=>{
        
    })
}, {
    once: true
})
