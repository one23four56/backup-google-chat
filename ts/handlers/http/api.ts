import { reqHandlerFunction } from ".";
import { parse } from '../../modules/parser'

const cache: Map<string, string> = new Map();

export const getThumbnail: reqHandlerFunction = async (req, res) => {

    const { url } = req.query;

    if (typeof url !== "string")
        return res.sendStatus(400)

    try {
        const object = new URL(url)
        if (object.protocol !== "https:")
            throw "";
    } catch {
        return res.sendStatus(400)
    }

    if (cache.has(url))
        return res.type("text/plain").send(cache.get(url));

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
        response = await fetch(url)
    } catch {
        return res.sendStatus(400)
    }

    if (!response.ok || !response.headers.get("Content-Type").includes("html"))
        return res.sendStatus(400)

    const parsed = parse.ogImage(await response.text());

    if (parsed) {
        cache.set(url, parsed);
        return res.type("text/plain").send(parsed);
    }

    res.status(404).type("text/plain").send("thumbnail not found")

}