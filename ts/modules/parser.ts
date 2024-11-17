import * as net from 'net';

export namespace parse {

    /**
     * Parses an open graph image link from a HTML string
     * @param doc html string
     */
    export function ogImage(doc: string): string | undefined {

        if (!doc.includes(`property="og:image"`))
            return;

        const propertyIndex = doc.search(`property="og:image"`)

        const
            tagStartIndex = (function left(index: number) {
                if (doc.charAt(index) !== "<")
                    return left(index - 1)

                return index;
            })(propertyIndex),
            tagEndIndex = (function right(index: number) {
                if (doc.charAt(index) !== ">")
                    return right(index + 1)

                return index;
            })(propertyIndex),
            tag = doc.slice(tagStartIndex, tagEndIndex)

        if (!tag.includes("content="))
            return;

        const contentStart = tag.indexOf(`content="`) + `content="`.length

        return tag.slice(
            contentStart,
            tag.indexOf(`"`, contentStart)
        )

    }

    export function email(email: string): false | string {
        if (email.length > 200) return false;
        // if (!email.endsWith("@wfbschools.com")) return false;
        if (!email.endsWith("@gmail.com")) return false;

        const split = email.split("@");
        if (split.length !== 2) return false;

        let [local] = split;
        local = local.toLocaleLowerCase();
        if (local.search(/\+|\(|\)| /g) !== -1) return false;

        local = local.replace(/\d/g, "");

        return local.split(".").map(e => e.split("-"))
            .map(e => e.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join("-"))
            .map(e => e.charAt(0).toUpperCase() + e.slice(1))
            .join(" ").slice(0, 30).trim();
    }

    export function ip(ip: string): string {
        if (net.isIP(ip) !== 0)
            return ip;

        // https://github.com/tjanczuk/iisnode/issues/94#issuecomment-3435115
        // iisnode might append a colon + 5-digit port to the end of the ip
        // in that case, net.isIP will fail, so the port has to be removed

        if (net.isIP(ip.slice(0, -6)))
            return ip.slice(0, -6)

        // could be IPv6 ([ip]:port)

        if (net.isIP(ip.slice(0, -6).replace(/\[|\]/g, "")))
            return ip.slice(0, -6).replace(/\[|\]/g, "");

        return "invalid";

    }

}