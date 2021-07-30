const socket = io();

let alert_countdown;
window.alert = (text) => {
    document.getElementById("alert").innerText = text;
    alert_countdown = setTimeout(() => {
        document.getElementById("alert").innerText = ""
    }, 5000);
}

function setCookie(cname, cvalue, exdays) {
    let exdate = new Date();
    exdate.setTime(exdate.getTime() + (exdays*24*60*60*1000));
    let expires = "expires="+ exdate.toUTCString();
    document.cookie = `${cname}=${cvalue};${expires};path=/;SameSite=Lax;Secure;SameParty;`
}

document.getElementById("emailform").addEventListener('submit', (event)=>{
    event.preventDefault()
    document.getElementById('submit').style.display = 'none'
    document.getElementById('pleasewait').style.display = 'initial'
    const formdata = new FormData(document.getElementById("emailform"))
    socket.emit('email-sign-in', formdata.get('email'), (response) => {
        switch (response) {
            case "bad_email":
                alert('The email you entered is not on our database. Please check for typos and try again using all lowercase letters, and if that does not work, contact me.');
                document.getElementById('submit').style.display = 'initial'
                document.getElementById('pleasewait').style.display = 'none'
                break;
            case "sent":
                alert('Email sent. Check your inbox for an email from chat.email.wfb@gmail.com. It may be in your Spam folder, so make sure to check there if you don\'t find it.')
                document.getElementById("emaildiv").remove()
                document.getElementById("confirmdiv").style.display = "initial"
                document.getElementById("confirmform").addEventListener('submit', event=>{
                    event.preventDefault()
                    const Cformdata = new FormData(document.getElementById("confirmform"))
                    socket.emit('confirm-code', Cformdata.get('confirm'), (response)=>{
                        switch (response.status) {
                            case "auth_done":
                                alert("Authentication succeeded. You will be redirected soon.")
                                setCookie('name', response.data.name, 30)
                                setCookie('mpid', response.data.mpid, 30)
                                setCookie('email', response.data.email, 30)
                                window.location.reload()
                                break;
                            case "auth_failed":
                            default:
                                alert("Authentication Failed.")
                                setTimeout(window.location.reload, 5000);
                                break;
                        }
                    })
                })
                break;
            case "send_err":
            default:
                alert('An unexpected error occurred during the sending of your email. Please try again and contact me if this persists.')
                document.getElementById('submit').style.display = 'initial'
                document.getElementById('pleasewait').style.display = 'none'
                break;
        }
    })
    socket.once('email-sent', _=>{
        
    })
})
