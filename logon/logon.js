const socket = io();

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

document.getElementById("form").addEventListener('submit', (event)=>{
    event.preventDefault()
    document.getElementById('submit').value = "Please wait..."
    let formdata = new FormData(document.getElementById("form"))
    socket.emit('email-sign-in', formdata.get('email'), (response) => {
        switch (response) {
            case "bad_email":
                alert('The email you entered is not on our database. Please check for typos and try again using all lowercase letters, and if that does not work, contact me.');
                document.getElementById('submit').value = "Reload Page"
                document.getElementById('submit').onclick = () => location.reload()
                break;
            case "sent":
                alert('Email sent. Check your inbox for an email from chat.email.wfb@gmail.com. It may be in your spam folder, so make sure to check there if you don\'t find it.')
                document.getElementById('email').value = ''
                document.getElementById('email').type = 'text'
                document.getElementById('email').name = 'confirm'
                document.querySelector('label[for="email"]').innerText = 'Please enter your confirmation code:'
                document.querySelector('label[for="email"]').for = 'confirm'
                document.getElementById('email').id = 'confirm'
                document.getElementById('submit').value = "Confirm"
                document.getElementById("form").addEventListener('submit', event=>{
                    event.preventDefault()
                    formdata = new FormData(document.getElementById("form"))
                    socket.emit('confirm-code', formdata.get('confirm'), (response)=>{
                        switch (response.status) {
                            case "auth_done":
                                alert("Authentication succeeded.")
                                setCookie('name', response.data.name, 30)
                                setCookie('mpid', response.data.mpid, 30)
                                setCookie('email', response.data.email, 30)
                                document.getElementById('submit').value = "Go"
                                document.getElementById('submit').onclick = () => location.reload()
                                break;
                            case "auth_failed":
                            default:
                                alert("Authentication failed.")
                                document.getElementById('submit').value = "Retry"
                                document.getElementById('submit').onclick = () => location.reload()
                                break;
                        }
                    })
                }, {
                    once: true
                })
                break;
            case "send_err":
            default:
                alert('An unexpected error occurred during the sending of your email. Please try again and contact me if this persists.')
                document.getElementById('submit').value = "Reload Page"
                document.getElementById('submit').onclick = () => location.reload()
                break;
        }
    })
    socket.once('email-sent', _=>{
        
    })
}, {
    once: true
})
