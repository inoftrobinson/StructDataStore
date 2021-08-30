export function separateAttrKeyPath(attrKeyPath: string): string[] {
    return attrKeyPath.split('.');
    // We separate all the elements of the attrKeyPath (for example,
    // 'container.fieldOne' becomes ['container', 'fieldOne'])
}