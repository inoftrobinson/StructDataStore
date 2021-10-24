import * as _ from "lodash";
import {PrimitiveAttrGetter} from "../models";


export function separateAttrKeyPath(attrKeyPath: string | string[]): string[] {
    return _.isArray(attrKeyPath) ? attrKeyPath : (attrKeyPath as string).split('.');
    // We separate all the elements of the attrKeyPath (for example,
    // 'container.fieldOne' becomes ['container', 'fieldOne'])
}

// todo: rename to render attrKeyPathWithQueryKwargs
export function separateAttrKeyPathWithQueryKwargs(attrKeyPath: string | string[], queryKwargs?: { [argKey: string]: any }): string[] {
    const attrKeyPathParts: string[] = separateAttrKeyPath(attrKeyPath);
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

export function renderAttrKeyPathWithQueryKwargs(attrKeyPath: string, queryKwargs?: { [argKey: string]: any }): string {
    return separateAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs).join('.');
}

export function separatePotentialGetterWithQueryKwargs(attrKeyPath: string | PrimitiveAttrGetter): string[] {
    return _.isString(attrKeyPath) ? separateAttrKeyPath(attrKeyPath) : separateAttrKeyPathWithQueryKwargs(attrKeyPath.attrKeyPath, attrKeyPath.queryKwargs);
}