
function encode(array: number[][]) {

    const step1 = array.map(i => encodeHelper(i).join("-"));
    const out = encodeHelper(step1, "z").join(".");

    return out
        .replace(/10/g, "a")
        .replace(/11/g, "b")
        .replace(/12/g, "c")
        .replace(/13/g, "d")
        .replace(/14/g, "e")
        .replace(/15/g, "f")
        .replace(/16/g, "g")
        .replace(/17/g, "h")
        .replace(/18/g, "i")
        .replace(/19/g, "j")
        .replace(/20/g, "k")
        .replace(/0xk/g, "n");
}

function encodeHelper(array: string[] | number[], concat: string = "x") {
    const out: string[] = [];

    let counter = 0;
    for (const [index, number] of array.entries()) {
        counter += 1;

        if (typeof array[index + 1] !== "undefined" && array[index + 1] === number)
            continue;


        let string = number.toString();
        if (counter !== 1)
            string = string.concat(concat, counter.toString());

        counter = 0;

        out.push(string);
    }

    return out;
}

function decode(string: string): number[][] {
    string = string.replace(/n/g, "0xk")
        .replace(/a/g, "10")
        .replace(/b/g, "11")
        .replace(/c/g, "12")
        .replace(/d/g, "13")
        .replace(/e/g, "14")
        .replace(/f/g, "15")
        .replace(/g/g, "16")
        .replace(/h/g, "17")
        .replace(/i/g, "18")
        .replace(/j/g, "19")
        .replace(/k/g, "20");

    const step1 = decodeHelper(string.split("."), "z");

    return step1.map(string => decodeHelper(string.split("-")).map(t => Number(t)));
}

function decodeHelper(items: string[], concat: string = "x") {
    const out: string[] = [];

    for (const item of items) {
        const [string, count] = item.split(concat);

        if (!count) {
            out.push(string);
            continue;
        }

        out.push(...Array(Number(count)).fill(string))
    }

    return out;
}

export default {
    encode, decode
}