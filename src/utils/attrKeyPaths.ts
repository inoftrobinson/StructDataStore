import * as _ from "lodash";


export function separateAttrKeyPath(attrKeyPath: string | string[]): string[] {
    return _.isArray(attrKeyPath) ? attrKeyPath : (attrKeyPath as string).split('.');
    // We separate all the elements of the attrKeyPath (for example,
    // 'container.fieldOne' becomes ['container', 'fieldOne'])
}