
const
    error = document.querySelector(`p[error="${location.hash}"]`) as HTMLElement,
    form = document.querySelector("form") as HTMLFormElement,
    button = document.querySelector("button") as HTMLButtonElement,
    h1 = document.querySelector("h1") as HTMLHeadingElement,
    i = document.querySelector("i") as HTMLElement;

if (error)
    error.style.display = "block";

form.addEventListener("submit", _event => {

    button.disabled = true;
    button.style.cursor = "default";
    button.title = "Please wait";

    h1.innerText = "Please wait...";

    i.className = "fa-solid fa-gear fa-spin"

});
