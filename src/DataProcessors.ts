import * as _ from 'lodash';
import * as immutable from 'immutable';
import {BaseFieldModel, MapModel, SetFieldModel, TypedDictFieldModel} from "./ModelsFields";
import {ACTIVE_SELF_DICT} from "./Serializers/smartSettersRemoversForRecursiveDifferences_new";
import {resolveResultOrCallbackResult} from "./utils/executors";


export function loadObjectDataToImmutableValuesWithFieldsModel<T>(objectData: { [attrKey: string]: any }, objectModel: MapModel): immutable.RecordOf<any> | null {
    // todo: return null on breaks all
    // We iterate over the objectModel fields instead of iterating over the data, because the record we want to be built will need to contains all
    // values in our model. We will populate the field's with their matching data, but the data that has not been matched to a field will be discarded.
    return immutable.Record(_.transform(objectModel.props.fields, (result: {}, fieldItem: BaseFieldModel | MapModel | TypedDictFieldModel, fieldKey: string) => {
        const matchingItemData: any | undefined = objectData[fieldKey];
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
                result[fieldKey] = immutable.Map(_.transform(matchingItemData, (result: {}, dictItem, dictKey) => {
                    result[dictKey] = loadObjectDataToImmutableValuesWithFieldsModel(
                        dictItem, fieldItem.props.itemType === ACTIVE_SELF_DICT ? objectModel : fieldItem.props.itemType
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
    }))();
}

export function mergeItemWithDefaultsModel<T extends { [attrKey: string]: any }>(
    item: { [attrKey: string]: any }, defaultsModel?: { [attrKey: string]: any }
): T {
    // We use the lodash merge function, which will deeply merge our item into our default item instance, which we need to
    // clone in order to not risk corrupting the model instance when the object will have been created and will be altered.
    return (defaultsModel !== undefined ? _.merge(_.cloneDeep(defaultsModel), item) : item) as T;
}

export function convertObjectItemsToImmutableValues(object: { [attrKey: string]: any }): { [attrKey: string]: any } {
   return _.transform(object, (result: {}, item: any, key: string) => {
       result[key] = immutable.fromJS(item);
   }, {});
}