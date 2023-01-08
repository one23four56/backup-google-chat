
if (location.hash.includes("error"))
    document.querySelector("p").style.display = "block";

document.querySelector("form").addEventListener("submit", _event => {

    document.querySelector("button").disabled = true;
    document.querySelector("button").style.cursor = "default";
    document.querySelector("button").title = "Please wait";

    document.querySelector("h1").innerText = "Please wait...";

    document.querySelector("i").className = "fa-solid fa-gear fa-spin"

})
