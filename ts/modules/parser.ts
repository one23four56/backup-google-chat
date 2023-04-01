
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

}