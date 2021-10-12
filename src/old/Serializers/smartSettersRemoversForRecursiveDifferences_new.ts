import * as _ from 'lodash';
import {deepRemoveNulls, shallowDifference, shallowMissingOrNull} from "../utils/general";
import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../ModelsFields";

export interface FieldSetterModel {
    fieldKey: string;
    value: any;
    queryKwargs?: {};
}

export interface FieldRemoverModel {
    fieldKey: string;
    queryKwargs?: {};
}

export interface ClientFieldItem {
    isKeyRecursive?: boolean;
    keyName?: string;
    // childrenActiveSelf?: boolean;
    children?: { [attrKey: string]: ClientFieldItem } | string;
    recursiveIndex?: number;
}

export const ACTIVE_SELF_DICT: string = '__ACTIVE_SELF_DICT__';


function fieldItemToClientFieldItem(item: BasicFieldModel | TypedDictFieldModel | MapModel): ClientFieldItem {
    // It is important that the instance check on the BasicFieldModel is done last, because even tough BasicFieldModel can be used by itself to
    // construct a field, the others models all inherit from BasicFieldModel, and so would trigger true to the instance check of BasicFieldModel.
    if (item instanceof MapModel) {
        const childrenClientFields: { [fieldKey: string]: ClientFieldItem } = _.mapValues(item.props.fields, fieldItemToClientFieldItem);
        return {children: childrenClientFields};
    } else if (item instanceof TypedDictFieldModel) {
        // An itemType of ACTIVE_SELF_DICT will be conserved, and we will not attempt to 'render' it here, because if we did,
        // the concept of the ACTIVE_SELF_DICT is to create an infinite recursive nested loop of the item into itself, which we
        // would try to initialize until infinity. Instead, it will be the serializer that will correctly construct a new
        // ClientFieldItem with the appropriate informations about the recursive step it is into, only when we need to serialize
        // recursive data. This allow us to theoretically have an infinite recursive depth, while only initializing it if we need to.
        const childrenClientFields: { [fieldKey: string]: ClientFieldItem } | string = (item.props.itemType !== ACTIVE_SELF_DICT ?
            _.mapValues((item.props.itemType as MapModel).props.fields, fieldItemToClientFieldItem) as { [fieldKey: string]: ClientFieldItem } : ACTIVE_SELF_DICT
        );
        return {isKeyRecursive: true, keyName: item.props.keyName, children: childrenClientFields, recursiveIndex: undefined};
        // Set recursiveIndex to undefined, and not to 0. Because each a recursive item will always use to recursiveIndex of its parent and
        // one to it to know what is its current recursive index. If it's undefined, the index will start at zero, which is what we want.
    } else if (item instanceof BasicFieldModel) {
        return {};
    } else {
        console.error(`Item of type ${typeof item} not supported`);
    }
}

function clientMakeSmartSettersRemoversForRecursiveDifferences(
    clientModel: ClientFieldItem,
    target: { [attrKey: string]: any },
    source: { [attrKey: string]: any } | null,
    basePath?: string,
    baseQueryKwargs?: { [kwargKey: string]: any }
): [ FieldSetterModel[], FieldRemoverModel[], boolean ] {

    const modifiedKeys: string[] = Object.keys(source != null ? shallowDifference(target, source) : target);
    const missingOrNullKeys: string[] = Object.keys(shallowMissingOrNull(source, target) as { [key: string]: boolean });

    const setters: FieldSetterModel[] = [];
    const removers: FieldRemoverModel[] = [];
    let fullChange: boolean = Object.keys(modifiedKeys).length > 0;
    // fullChange can be set to false inside the modifiedKeys loop, and will be set to false if
    // no modified keys are present, since this means that the items has not been modified at all.

    _.forEach(missingOrNullKeys, (itemKey: string) => {
        const matchingModelItem: MapModel | BasicFieldModel | TypedDictFieldModel | undefined = clientModel.children[itemKey];
        if (matchingModelItem === undefined) {
            console.log(`No model item found for key ${itemKey}`);
        } else {
            const itemFieldKey: string = basePath !== undefined ? `${basePath}.${itemKey}` : itemKey;
            removers.push({
                fieldKey: itemFieldKey,
                queryKwargs: baseQueryKwargs,
            });
        }
    });

    _.forEach(modifiedKeys, (itemKey: string) => {
        const targetItemValue: any = target[itemKey];
        if (targetItemValue != null) {
            // If the targetItemValue is null, this matching field remover
            // will already have been added by the missingOrNullKeys loop.
            let matchingModelItem: ClientFieldItem | undefined = clientModel.children[itemKey];
            if (matchingModelItem === undefined) {
                console.log(`No model item found for key ${itemKey}`);
            } else {
                const sourceItemValue: any | undefined = source?.[itemKey];
                if (_.isEqual(targetItemValue, sourceItemValue)) {
                    fullChange = false;
                } else {
                    const itemFieldKey: string = basePath !== undefined ? `${basePath}.${itemKey}` : itemKey;
                    if (matchingModelItem.children === undefined && matchingModelItem.isKeyRecursive !== true) {
                        setters.push({
                            fieldKey: itemFieldKey,
                            queryKwargs: baseQueryKwargs,
                            value: targetItemValue
                        });
                    } else {
                        const matchingChildrenFieldItem: ClientFieldItem = matchingModelItem.children !== ACTIVE_SELF_DICT ?
                            { children: matchingModelItem.children as { [attrKey: string]: ClientFieldItem } } :
                            (() => {
                                const retrievedRecursiveIndex: number | undefined = matchingModelItem.recursiveIndex;
                                const currentRecursiveIndex: number = retrievedRecursiveIndex !== undefined ? retrievedRecursiveIndex + 1 : 0;
                                matchingModelItem = {
                                    ...matchingModelItem,
                                    keyName: `${matchingModelItem.keyName}${currentRecursiveIndex}`,
                                    recursiveIndex: currentRecursiveIndex
                                };
                                return matchingModelItem;
                                /*const newAlteredModel: MapModel = new MapModel({fields: {...model.props.fields, [itemKey]: matchingModelItem}});
                                return newAlteredModel;*/
                            })();

                        if (matchingModelItem.isKeyRecursive !== true) {
                            const [itemChildSetters, itemChildRemovers, itemFullChange] = clientMakeSmartSettersRemoversForRecursiveDifferences(
                                matchingChildrenFieldItem, targetItemValue, sourceItemValue, itemFieldKey, baseQueryKwargs
                            );
                            if (itemFullChange === true) {
                                const cleanedTargetItemValue = deepRemoveNulls(targetItemValue);
                                setters.push({
                                    fieldKey: itemFieldKey,
                                    queryKwargs: baseQueryKwargs,
                                    value: cleanedTargetItemValue
                                });
                            } else {
                                // Use of granular imports
                                setters.push(...itemChildSetters);
                                removers.push(...itemChildRemovers);
                                fullChange = false;
                            }
                        } else {
                            _.forEach(targetItemValue, (targetItemChildValue: any, itemChildKey: string) => {
                                const itemChildFieldKey: string = `${itemFieldKey}.{{${matchingModelItem.keyName}}}`;
                                const itemChildSourceValue: any = sourceItemValue?.[itemChildKey];
                                const itemChildQueryKwargs = {
                                    ...baseQueryKwargs,
                                    [matchingModelItem.keyName]: itemChildKey
                                };

                                const [itemChildSetters, itemChildRemovers, itemChildFullChange] = clientMakeSmartSettersRemoversForRecursiveDifferences(
                                    matchingChildrenFieldItem, targetItemChildValue, itemChildSourceValue, itemChildFieldKey, itemChildQueryKwargs
                                );
                                if (itemChildFullChange === true) {
                                    const cleanedTargetItemChildValue = deepRemoveNulls(targetItemChildValue);
                                    setters.push({
                                        fieldKey: itemChildFieldKey,
                                        queryKwargs: itemChildQueryKwargs,
                                        value: cleanedTargetItemChildValue
                                    });
                                } else {
                                    // Use of granular imports
                                    setters.push(...itemChildSetters);
                                    removers.push(...itemChildRemovers);
                                    fullChange = false;
                                }
                            });
                        }
                    }
                }
            }
        }
    });
    return [setters, removers, fullChange];
}

export default function makeSmartSettersRemoversForRecursiveDifferences(
    model: MapModel, target: { [attrKey: string]: any }, source: { [attrKey: string]: any } | null,
): [ FieldSetterModel[], FieldRemoverModel[], boolean ] {
    const clientMapModel: ClientFieldItem = fieldItemToClientFieldItem(model);
    return clientMakeSmartSettersRemoversForRecursiveDifferences(clientMapModel, target, source);
}