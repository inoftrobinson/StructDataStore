import * as _ from 'lodash';
import * as immutable from 'immutable';
import {BasicFieldModel, ContainerFieldModel, MapModel, SetFieldModel, TypedDictFieldModel} from "./ModelsFields";
import {resolveResultOrCallbackResult} from "./utils/executors";


type FieldModel = BasicFieldModel | MapModel | TypedDictFieldModel | SetFieldModel;

/*
function rar(fields: { [fieldKey: string]: FieldModel }, data: { [attrKeyPath: string]: any }) {
    const recordValues = _.transform(fields, (result: { [p: string]: any}, fieldItem: FieldModel, fieldKey: string) => {
        const matchingItemData: any | undefined = data[fieldKey];
        if (matchingItemData == null) {
            if (fieldItem.props.required !== true) {
                result[fieldKey] = (fieldItem.props.customDefaultValue !== undefined ?
                        resolveResultOrCallbackResult(fieldItem.props.customDefaultValue) : undefined
                );
            } else {
                console.log(`Missing ${fieldKey}. Breaks all`);
            }
        } else {
            if (fieldItem instanceof TypedDictFieldModel) {
                // We directly iterate over the matchingItemData, because a TypedDictFieldModel will generate an unconstrained Map.
                result[fieldKey] = immutable.Map(_.transform(matchingItemData, (result: { [p: string]: any }, dictItem: any, dictKey: string) => {
                    result[dictKey] = loadObjectDataToImmutableValuesWithFieldsModel(
                        dictItem, fieldItem.props.itemType === '__ACTIVE_SELF_DICT__' ? fieldItem : fieldItem.props.itemType
                    );
                }, {}));
            } else if (fieldItem instanceof MapModel) {
                result[fieldKey] = loadObjectDataToImmutableValuesWithFieldsModel(matchingItemData, fieldItem);
            } else if (fieldItem instanceof SetFieldModel) {
                const itemDataIsArrayLike: boolean = _.isArrayLike(matchingItemData);
                result[fieldKey] = immutable.Set(itemDataIsArrayLike ? matchingItemData : []);
            } else {
                result[fieldKey] = immutable.fromJS(matchingItemData);
            }
        }
    });
    return recordValues;
}
 */

/*export function loadObjectDataToImmutableValuesWithFieldsModel<T extends {}>(
    objectData: { [attrKey: string]: any }, containerModel: ContainerFieldModel<any>
): immutable.RecordOf<T> | null {
    // todo: return null on breaks all
    // We iterate over the objectModel fields instead of iterating over the data, because the record we want to be built will need to contains all
    // values in our model. We will populate the field's with their matching data, but the data that has not been matched to a field will be discarded.
    const recordValues = (() => {
        switch (containerModel.type) {
            case TypedDictFieldModel.TYPE:
                // We directly iterate over the matchingItemData, because a TypedDictFieldModel will generate an unconstrained Map.
                return immutable.Map(_.transform(objectData, (result: { [p: string]: any }, dictItem: any, dictKey: string) => {
                    result[dictKey] = loadObjectDataToImmutableValuesWithFieldsModel(
                        dictItem, containerModel.props.itemType === '__ACTIVE_SELF_DICT__' ? containerModel : containerModel.props.itemType
                    );
                }, {}));
            case MapModel.TYPE:
                return loadObjectDataToImmutableValuesWithFieldsModel(objectData, containerModel);
            default:
                console.log(`Unsupported containerModel type ${containerModel.type} for :`);
                console.log(containerModel);
                return {};
        }
    })();
    const recordDefaultValues = _.mapValues(recordValues, () => undefined) as T;
    // We set the defaultValues to a map of undefined values for all the keys in our recordValues. This is crucial, as this allows
    //the deletion and removal of fields. Otherwise, the default values would be restored when the fields are deleted/removed.
    const recordFactory: immutable.Record.Factory<T> = immutable.Record<T>(recordDefaultValues);
    // The default values are used to created a record factory.
    return recordFactory(recordValues as Partial<T>);
    // The record is created by passing the values to populate to the record factory.
}
 */

export function loadObjectDataToImmutableValuesWithFieldsModel<T extends {}>(
    objectData: { [attrKey: string]: any }, containerModel: ContainerFieldModel<any>
): immutable.RecordOf<T> | null {
    return containerModel.dataLoader(objectData);
}


/*export function loadObjectDataToImmutableValuesWithFieldsModel<T extends {}>(
    objectData: { [attrKey: string]: any }, objectModel: MapModel | TypedDictFieldModel | SetFieldModel | BasicFieldModel
): immutable.RecordOf<T> | null {
    // todo: return null on breaks all
    // We iterate over the objectModel fields instead of iterating over the data, because the record we want to be built will need to contains all
    // values in our model. We will populate the field's with their matching data, but the data that has not been matched to a field will be discarded.
    if (fieldItem instanceof MapModel) {
        result[fieldKey] = loadObjectDataToImmutableValuesWithFieldsModel(matchingItemData, fieldItem);
        const recordValues = _.transform(objectModel.props.fields, 
            (result: { [p: string]: any}, fieldItem: BasicFieldModel | MapModel | TypedDictFieldModel, fieldKey: string) => {
                const matchingItemData: any | undefined = objectData[fieldKey];
                if (matchingItemData == null) {
                    if (fieldItem.props.required !== true) {
                        result[fieldKey] = (fieldItem.props.customDefaultValue !== undefined ?
                                resolveResultOrCallbackResult(fieldItem.props.customDefaultValue) : undefined
                        );
                    } else {
                        console.log(`Missing ${fieldKey}. Breaks all`);
                    }
                }
            }
        );
    } else if (fieldItem instanceof TypedDictFieldModel) {
        // We directly iterate over the matchingItemData, because a TypedDictFieldModel will generate an unconstrained Map.
        result[fieldKey] = immutable.Map(_.transform(matchingItemData, (result: { [p: string]: any }, dictItem: any, dictKey: string) => {
            result[dictKey] = loadObjectDataToImmutableValuesWithFieldsModel(
                dictItem, fieldItem.props.itemType === '__ACTIVE_SELF_DICT__' ? objectModel : fieldItem.props.itemType
            );
        }, {}));
    } else if (fieldItem instanceof SetFieldModel) {
        const itemDataIsArrayLike: boolean = _.isArrayLike(matchingItemData);
        result[fieldKey] = immutable.Set(itemDataIsArrayLike ? matchingItemData : []);
    } else {
        result[fieldKey] = immutable.fromJS(matchingItemData);
    }
            }
        }
    );
    const recordDefaultValues = _.mapValues(recordValues, () => undefined) as T;
    // We set the defaultValues to a map of undefined values for all the keys in our recordValues. This is crucial, as this allows
    //the deletion and removal of fields. Otherwise, the default values would be restored when the fields are deleted/removed.
    const recordFactory: immutable.Record.Factory<T> = immutable.Record<T>(recordDefaultValues);
    // The default values are used to created a record factory.
    return recordFactory(recordValues as Partial<T>);
    // The record is created by passing the values to populate to the record factory.
}*/

export function mergeItemWithDefaultsModel<T extends { [attrKey: string]: any }>(
    item: { [attrKey: string]: any }, defaultsModel?: { [attrKey: string]: any }
): T {
    // We use the lodash merge function, which will deeply merge our item into our default item instance, which we need to
    // clone in order to not risk corrupting the model instance when the object will have been created and will be altered.
    return (defaultsModel !== undefined ? _.merge(_.cloneDeep(defaultsModel), item) : item) as T;
}

export function convertObjectItemsToImmutableValues(object: { [attrKey: string]: any }): { [attrKey: string]: any } {
   return _.transform(object, (result: { [p: string]: any }, item: any, key: string) => {
       result[key] = immutable.fromJS(item);
   }, {});
}