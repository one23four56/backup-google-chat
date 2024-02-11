
export function sort(method: sortMethod) {
    const elements = [...document.getElementById("files")?.children as HTMLCollection] as HTMLElement[];

    for (const element of method(elements))
        document.getElementById("files")?.appendChild(element);
}

type sortMethod = (elements: HTMLElement[]) => HTMLElement[];

// takes sort method as input, returns new function that is the same sort method but reversed
const reverse: (m: sortMethod) => sortMethod = m => e => m(e).reverse();

const collator = new Intl.Collator('en-US')

const file: sortMethod =
    // @ts-expect-error this would be 10x longer with type safety, which isn't even needed
    e => e.sort((a, b) => collator.compare(a.children.item(1).innerText, b.children.item(1).innerText));

const uploader: sortMethod =
    //@ts-expect-error this would be 10x longer with type safety, which isn't even needed
    e => e.sort((a, b) => collator.compare(a.children.item(2).innerText, b.children.item(2).innerText));

const type: sortMethod =
    //@ts-expect-error this would be 10x longer with type safety, which isn't even needed
    e => e.sort((a, b) => collator.compare(a.children.item(3).innerText, b.children.item(3).innerText));

const size: sortMethod =
    e => e.sort((a, b) => Number(b.dataset.size) - Number(a.dataset.size));

const time: sortMethod =
    e => e.sort((a, b) => Number(b.dataset.time) - Number(a.dataset.time));

export const methods = {
    reverse, file, uploader, type, size, time
}

