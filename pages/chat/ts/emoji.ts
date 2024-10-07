import settings from './settings';
import { closeDialog } from './popups';

/**
 * *Note:* EmojiMart is imported via a script in index.html
 * ts-expect-error is used to avoid needing `declare` black magic to get types working
 * docs: https://github.com/missive/emoji-mart
 */

//@ts-expect-error
EmojiMart.init({
    // data: () => fetch("/public/emoji-data.json").then(r => r.json())
    data: () => fetch("https://cdn.jsdelivr.net/npm/@emoji-mart/data").then(r => r.json())
});

/**
 * Opens the emoji selector
 * @param modal True to open the selector as a modal dialog in the center of the page
 */
export function emojiSelector(modal: true): Promise<string>;
/**
 * Opens the emoji selector
 * @param x X position to open at
 * @param y Y position to open at
 */
export function emojiSelector(x: number, y: number): Promise<string>;
export function emojiSelector(x: number | boolean, y?: number): Promise<string> {
    return new Promise((resolve, reject) => {
        //@ts-expect-error
        const picker = new EmojiMart.Picker({
            // https://github.com/missive/emoji-mart?tab=readme-ov-file#options--props
            onEmojiSelect: emoji => {
                if (picker.dataset.open !== "true") return;
                if (dialog) closeDialog(dialog);
                else picker.remove();
                resolve(emoji.native);
            },
            onClickOutside: () => {
                if (picker.dataset.open !== "true") return;
                if (dialog) closeDialog(dialog);
                else picker.remove();
                reject();
            },
            autoFocus: x === true,
            theme: settings.get.themeType(),
            previewEmoji: "dotted_line_face",
        }) as unknown as HTMLElement;

        picker.style.zIndex = "3";

        // override style to make it use noto emoji no matter what
        const style = new CSSStyleSheet();
        style.replaceSync(`span.emoji-mart-emoji span { font-family: "Noto Color Emoji" !important; }`);
        picker.shadowRoot.adoptedStyleSheets.push(style);

        let dialog: HTMLDialogElement;
        if (typeof x === "number" && typeof y === "number") {
            document.body.appendChild(picker);
            picker.style.position = "absolute";
            picker.style.left = Math.min((Math.max(x - picker.offsetWidth, 0)), window.innerWidth - picker.offsetWidth) + "px"
            picker.style.top = Math.min(Math.max(y - picker.offsetHeight, 0), window.innerHeight - picker.offsetHeight) + "px"
        } else {
            picker.style.top = "";
            picker.style.left = "";
            dialog = document.body.appendChild(document.createElement("dialog"));
            dialog.appendChild(picker);
            dialog.showModal();
            dialog.classList.add("emoji")
        }

        setTimeout(() => {
            picker.dataset.open = "true";
        }, -1);
    })
}