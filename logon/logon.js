const socket = io();

function setCookie(cname, cvalue, exdays) {
    let exdate = new Date();
    exdate.setTime(exdate.getTime() + (exdays*24*60*60*1000));
    let expires = "expires="+ exdate.toUTCString();
    document.cookie = `${cname}=${cvalue};${expires};path=/;SameSite=Lax;Secure;SameParty;`
}

document.getElementById("emailform").addEventListener('submit', (event)=>{
    event.preventDefault()
    document.getElementById('submit').remove()
    document.getElementById('pleasewait').style.display = 'initial'
    const formdata = new FormData(document.getElementById("emailform"))
    socket.emit('email-sign-in', formdata.get('email'))
    socket.once('bademail', _=>{
        alert('The email you entered is not on our database. Please check for typos and try again using all lowercase letters, and if that does not work, contact me.')
        window.location.reload()
    })
    socket.once('unknown-err', _=>{
        alert('There was an error while sending the email. Please try again.')
        window.location.reload()
    })
    socket.once('email-sent', _=>{
        alert('Check your inbox for an email from chat.email.wfb@gmail.com')
        document.getElementById("emaildiv").remove()
        document.getElementById("confirmdiv").style.display = "initial"
        document.getElementById("confirmform").addEventListener('submit', event=>{
            event.preventDefault()
            const Cformdata = new FormData(document.getElementById("confirmform"))
            socket.emit('confirm-code', Cformdata.get('confirm'))
            socket.once('auth-failed', _=>{
                alert("Authentication Failed")
                window.location.reload()
            })
            socket.once('auth-done', userdata=>{
                setCookie('name', userdata.name, 30)
                setCookie('cdid', userdata.cdid, 30)
                setCookie('authname', userdata.authname, 30)
                alert('Authentication completed. Press ok to continue.')
                window.location.reload()
            })
        })
    })
})
