import * as _ from "lodash";


export function renderAttrKeyPathWithQueryKwargs(attrKeyPath: string, queryKwargs?: { [argKey: string]: any }): string[] {
    const attrKeyPathParts: string[] = attrKeyPath.split('.');
    const processedAttrKeyPathParts: string[] = _.map(attrKeyPathParts, (pathPart: string) => {
        const matches: RegExpMatchArray | null = pathPart.match(/^({{)(.*)(}})$/);
        if (matches == null) return pathPart;

        const keyValue: string = matches[2];
        if (keyValue.length > 0) {
            const matchingQueryKwarg: any | undefined = queryKwargs?.[keyValue];
            if (matchingQueryKwarg !== undefined) {
                return matchingQueryKwarg;
            } else {
                console.error(`No matching queryKwarg found for ${keyValue} in ${attrKeyPath}`);
                return "missingQueryKwargPlaceholder";
                // todo: remove placeholder and make the entire function return null
            }
        }
    });
    return processedAttrKeyPathParts;
}
