
fetch('/me').then(res => {
    res.json().then(data => {
        globalThis.me = data

        document.getElementById("acc-data").innerText = `Name: ${data.name}\n\nEmail: ${data.email}\n\nUser ID: ${data.id}`;
        document.getElementById("acc-data").innerText += "\nYour user ID is not sensitive information. You may share it with others.";

        document.getElementById("pfp").src = data.img;
        document.getElementById("pfp").alt = "Profile Picture";
    })
})