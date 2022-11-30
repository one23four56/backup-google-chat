const themeLightMode = {
    '--main-text-color': 'black',
    '--main-bg-color': 'white',
    '--main-hover-color': 'hsl(0, 0%, 85%)',
    '--main-border-color': 'hsl(0, 0%, 75%)',
    '--main-button-color': 'hsl(0, 0%, 81%)',
    '--main-holder-color': 'hsla(0, 0%, 0%, 0.5)',
    '--main-header-color': 'hsl(0, 0%, 90%)',
    '--main-box-shadow-color': 'hsl(0, 0%, 70%)',
    '--alt-text-color': 'hsl(0, 0%, 25%)'
}

const themeDarkMode = {
    '--main-text-color': 'white',
    '--main-bg-color': 'hsl(0, 0%, 8%)',
    '--main-hover-color': 'hsl(0, 0%, 30%)',
    '--main-border-color': 'hsl(0, 0%, 75%)',
    '--main-button-color': 'hsl(0, 0%, 81%)',
    '--main-holder-color': 'hsla(0, 0%, 15%, 0.5)',
    '--main-header-color': 'hsl(0, 0%, 0%)',
    '--main-box-shadow-color': 'hsl(0, 0%, 20%)',
    '--alt-text-color': 'hsl(0, 0%, 80%)'
}

const themeUkraine = {
    '--main-text-color': 'rgb(255,213,0)',
    '--main-bg-color': 'rgb(0,91,187)',
    '--main-hover-color': 'rgb(0,91,187)',
    '--main-border-color': 'rgb(255,213,0)',
    '--main-button-color': 'rgb(0,91,187)',
    '--main-holder-color': 'hsla(0, 0%, 15%, 0.5)',
    '--main-header-color': 'rgb(0,91,187)',
    '--main-box-shadow-color': 'rgb(0,91,187)',
}
const setTheme = (theme) => {
    const root = document.querySelector(':root').style
    for (const name in theme) {
        root.setProperty(name, theme[name])
    }
}
const updateTheme = () => {
    if (localStorage.getItem('settings')) {
        const settings = JSON.parse(localStorage.getItem('settings'))
        if (settings['display-settings-light-mode']) setTheme(themeLightMode)
        else if (settings['display-settings-dark-mode']) setTheme(themeDarkMode)
        else if (settings['display-settings-ukraine']) setTheme(themeUkraine)
    }
}
updateTheme()