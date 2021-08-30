import * as _ from 'lodash';
import {deepRemoveNulls, shallowDifference, shallowMissingOrNull} from "../utils/general";

export interface FieldSetterModel {
    fieldKey: string;
    value: any;
    queryKwargs?: {};
}

export interface FieldRemoverModel {
    fieldKey: string;
    queryKwargs?: {};
}

export interface ModelItem {
    isKeyRecursive?: boolean;
    keyName?: string;
    childrenActiveSelf?: boolean;
    children?: { [attrKey: string]: ModelItem } | string;
    recursiveIndex?: number;
}

export const ACTIVE_SELF_DICT = '__ACTIVE_SELF_DICT__';


export default function makeSmartSettersRemoversForRecursiveDifferences(
    model: { [attrKey: string]: ModelItem },
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
        const matchingModelItem: ModelItem | undefined = model[itemKey];
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
            let matchingModelItem: ModelItem | undefined = model[itemKey];
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
                        const matchingChildren = matchingModelItem.children !== ACTIVE_SELF_DICT ?
                            matchingModelItem.children as { [attrKey: string]: ModelItem } :
                            (() => {
                                const retrievedRecursiveIndex: number | undefined = matchingModelItem.recursiveIndex;
                                const currentRecursiveIndex: number = retrievedRecursiveIndex !== undefined ? retrievedRecursiveIndex + 1 : 0;
                                matchingModelItem = {
                                    ...matchingModelItem,
                                    keyName: `${matchingModelItem.keyName}${currentRecursiveIndex}`,
                                    recursiveIndex: currentRecursiveIndex
                                };
                                return model;
                                // return {...matchingModelItem, keyName: `${matchingModelItem.keyName}${currentRecursiveIndex}`, recursiveIndex: currentRecursiveIndex};
                            })();

                        if (matchingModelItem.isKeyRecursive !== true) {
                            const [itemChildSetters, itemChildRemovers, itemFullChange] = makeSmartSettersRemoversForRecursiveDifferences(
                                matchingChildren, targetItemValue, sourceItemValue, itemFieldKey, baseQueryKwargs
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

                                const [itemChildSetters, itemChildRemovers, itemChildFullChange] = makeSmartSettersRemoversForRecursiveDifferences(
                                    matchingChildren, targetItemChildValue, itemChildSourceValue, itemChildFieldKey, itemChildQueryKwargs
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