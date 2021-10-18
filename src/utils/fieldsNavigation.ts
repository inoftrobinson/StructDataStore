import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../ModelsFields";


export function navigateToAttrKeyPathIntoMapModel(mapModel: MapModel, attrKeyPath: string): BasicFieldModel | TypedDictFieldModel | MapModel | null {
    const attrKeyPathParts: string[] = attrKeyPath.split('.');
    let currentMapModel: MapModel = mapModel;
    for (let i = 0; i < attrKeyPathParts.length; i++) {
        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | undefined = currentMapModel.props.fields[attrKeyPathParts[i]];
        if (matchingField !== undefined && matchingField instanceof MapModel) {
            currentMapModel = matchingField as MapModel;
        } else {
            return null;
        }
    }
    return currentMapModel;
}