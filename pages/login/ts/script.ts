
const
    qs = <type extends HTMLElement>(id: string) => document.querySelector(id) as type,
    error = qs(`p[error="${location.hash}"]`),
    button = qs<HTMLButtonElement>("button");

if (error)
    error.style.display = "block";

qs("form").addEventListener("submit", _event => {

    button.disabled = true;
    button.style.cursor = "default";
    button.title = "Please wait";

    qs("h1").innerText = "Please wait...";

    qs("i").className = "fa-solid fa-gear fa-spin"

});
