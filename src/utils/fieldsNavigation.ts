import {BasicFieldModel, ContainerFieldModel, MapModel, TypedDictFieldModel} from "../ModelsFields";

/*
function getMapModelAtPathParts(
    baseMapModel: MapModel, attrKeyPathParts: string[],
    callback?: (mapField: MapModel, attrKeyPath: string) => any
): MapModel | null {
    let currentMapModel: MapModel = baseMapModel;
    for (let i = 0; i < attrKeyPathParts.length; i++) {
        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | undefined = currentMapModel.props.fields[attrKeyPathParts[i]];
        if (matchingField !== undefined && matchingField instanceof MapModel) {
            currentMapModel = matchingField as MapModel;
            if (callback !== undefined) {
                const currentAttrKeyPath: string = attrKeyPathParts.slice(0, i+1).join('.');
                callback(matchingField, currentAttrKeyPath);
            }
        } else {
            return null;
        }
    }
    return currentMapModel;
}

export function navigateToAttrKeyPathIntoMapModel(
    mapModel: MapModel, attrKeyPath: string,
    callback?: (mapField: MapModel, attrKeyPath: string) => any
): BasicFieldModel | TypedDictFieldModel | MapModel | null {
    const attrKeyPathParts: string[] = attrKeyPath.split('.');
    const navigatedMapModel: MapModel | null = getMapModelAtPathParts(mapModel, attrKeyPathParts.slice(0, -1), callback);
    return navigatedMapModel != null ? navigatedMapModel.props.fields[attrKeyPathParts.slice(-1)[0]] : null;
}
 */

export function navigateToAttrKeyPathPartsIntoMapModel(
    containerFieldModel: ContainerFieldModel<any>, attrKeyPathParts: string[],
    // foundAttrKeyPathPartFieldModelCallback?: (mapField: MapModel, attrKeyPath: string) => any
): BasicFieldModel | TypedDictFieldModel | MapModel | null {
    const [currentFieldModel, remainingAttrKeyPathParts] = containerFieldModel.navigateToAttrModel(attrKeyPathParts);
    if (remainingAttrKeyPathParts.length > 0) {
        if (currentFieldModel instanceof ContainerFieldModel) {
            return navigateToAttrKeyPathPartsIntoMapModel(currentFieldModel, remainingAttrKeyPathParts);
        } else {
            return null;
        }
    } else {
        /*if (foundAttrKeyPathPartFieldModelCallback !== undefined) {
            const currentAttrKeyPath: string = attrKeyPathParts.slice(0, i+1).join('.');
            foundAttrKeyPathPartFieldModelCallback(currentFieldModel, currentAttrKeyPath);
        }*/
        return currentFieldModel;
    }
}

export function navigateToAttrKeyPathIntoMapModelV2(
    mapModel: MapModel, attrKeyPath: string,
    callback?: (mapField: MapModel, attrKeyPath: string) => any
): BasicFieldModel | TypedDictFieldModel | MapModel | null {
    const attrKeyPathParts: string[] = attrKeyPath.split('.');
    return navigateToAttrKeyPathPartsIntoMapModel(mapModel, attrKeyPathParts);
}

/*
export function executeCallbackForEachAttrKeyPathIntoMapModel(
    mapModel: MapModel, attrKeyPath: string, callback?: (fieldModel: any, attrKeyPath: string) => any
): void {

}
 */
