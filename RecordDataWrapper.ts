import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "./DataProcessors";
import {BaseFieldModel, MapModel, TypedDictFieldModel} from "./ModelsFields";
import RecordSubscriptionsWrapper from "./RecordSubscriptionsWrapper";


export default class RecordDataWrapper<T> {
    constructor(
        public subscriptionsWrapper: RecordSubscriptionsWrapper<T>,
        public RECORD_DATA: immutable.RecordOf<T>,
        public readonly itemModel: MapModel
    ) {
    }

    static fromRecord<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>, itemModel: MapModel, record:immutable.RecordOf<T>) {
        return new RecordDataWrapper<T>(subscriptionsWrapper, record, itemModel);
    }

    static fromData<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>, itemModel: MapModel, data: T) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
        return new RecordDataWrapper<T>(subscriptionsWrapper, record, itemModel);
    }

    static fromEmpty<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>, itemModel: MapModel) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel({}, itemModel) as immutable.RecordOf<T>;
        return new RecordDataWrapper<T>(subscriptionsWrapper, record, itemModel);
    }

    /*static fromNull<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>) {
        return new RecordDataWrapper<T>(subscriptionsWrapper);
    }*/


    updateRecord(record:immutable.RecordOf<T> | null): { subscribersPromise: Promise<any> } {
        this.RECORD_DATA = record;
        const subscribersPromise: Promise<any> = this.subscriptionsWrapper.triggerAllSubscribers();
        return {subscribersPromise};
    }

    updateRecordFromData(itemModel: MapModel, data: T): { subscribersPromise: Promise<any> } {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
        return this.updateRecord(record);
    }

    /*private safeNavigateIntoAttributeData(
        itemMapModel: MapModel, keyPathElements: string[],
        parentAttributeData: any, parentRecordData: immutable.RecordOf<T>
    ) {
        const firstKeyPathElement: string = keyPathElements[0];
        const matchingFieldItem: MapModel | BaseFieldModel | TypedDictFieldModel | undefined = itemMapModel.props.fields[firstKeyPathElement];
        if (matchingFieldItem === undefined) {
            console.warn(`No field model found for ${firstKeyPathElement}`);
            return [false, null, undefined];
        }
        if (matchingFieldItem instanceof MapModel) {
            const currentItemMapModel = matchingFieldItem;
            // todo: validate
            if (keyPathElements.length > 1) {
                return this.safeNavigateIntoAttributeData(matchingFieldItem, keyPathElements.slice(1),)
            }

        } else if (matchingFieldItem instanceof TypedDictFieldModel && matchingFieldItem.props.itemType instanceof MapModel) {
            currentItemMapModel = matchingFieldItem.props.itemType;

        } else {
            console.warn(`Field '${keyPathElement}' not valid`);
            return [ false, null, undefined ];
        }

        const existingAttributeValue: any | undefined = alteredRecordData.get(keyPathElement);
        lastAttributeValue = (
            existingAttributeValue !== undefined ? existingAttributeValue : (() => {
                const defaultValue = matchingFieldItem.makeDefault();
                alteredRecordData.set(keyPathElement, defaultValue);
                return defaultValue;
            }
        )());
    }

    private safeAlterRecordDataInPath(attrKeyPathElements: string[], immutableValue: any): [ boolean, immutable.RecordOf<T> | null, any ] {
        const alteredRecordData = this.RECORD_DATA;
        let currentItemMapModel: MapModel = this.itemModel;
        let lastAttributeValue: any = undefined;

        const attrKeyPathElementsToNavigateInto: string[] = attrKeyPathElements.slice(0, -1);
        for (let keyPathElement of attrKeyPathElementsToNavigateInto) {
            const matchingFieldItem: MapModel | BaseFieldModel | TypedDictFieldModel | undefined = currentItemMapModel.props.fields[keyPathElement];
            if (matchingFieldItem === undefined) {
                console.warn(`No field model found for ${keyPathElement}`);
                return [false, null, undefined];
            }
            if (matchingFieldItem instanceof MapModel) {
                currentItemMapModel = matchingFieldItem;
            } else if (matchingFieldItem instanceof TypedDictFieldModel && matchingFieldItem.props.itemType instanceof MapModel) {
                currentItemMapModel = matchingFieldItem.props.itemType;
            } else {
                console.warn(`Field '${keyPathElement}' not valid`);
            }

            const existingAttributeValue: any | undefined = alteredRecordData.get(keyPathElement);
            lastAttributeValue = (
                existingAttributeValue !== undefined ? existingAttributeValue : (() => {
                    const defaultValue = matchingFieldItem.makeDefault();
                    alteredRecordData.set(keyPathElement, defaultValue);
                    return defaultValue;
                }
            )());
        }

        const lastAttrKeyPathElement: string = attrKeyPathElements.slice(-1)[0];
        const oldLastAttributeValue = lastAttributeValue.get(lastAttrKeyPathElement);
        lastAttributeValue.set(lastAttrKeyPathElement, immutableValue);
        return [true, alteredRecordData, oldLastAttributeValue];
    }*/

    /*const [alterSuccess, alteredRecordData, oldAttributeValue] = this.safeAlterRecordDataInPath(attrKeyPathElements, immutableValue);*/

    updateAttr(attrKeyPath: string, value: any): { oldValue: any | undefined, subscribersPromise: Promise<any> } {
        const immutableValue: any = immutable.fromJS(value);
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        // const serialized = this.RECORD_DATA.toJS();
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.setIn(attrKeyPathElements, immutableValue);
        const subscribersPromise = this.subscriptionsWrapper.triggerSubscribersForAttr(attrKeyPath);
        return { oldValue, subscribersPromise };
    }

    updateMultipleAttrs<T extends { [attrKeyPath: string]: any }>(mutators: Partial<T>): {
        oldValues: IterableIterator<[keyof T, T[keyof T]]>, subscribersPromise: Promise<any>
    } {
        const mutatorsKeys: string[] = Object.keys(mutators);
        if (!(mutatorsKeys.length > 0)) {
            return {oldValues: {}, subscribersPromise: new Promise(resolve => resolve())};
        }
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [attrKeyPath: string]: any | undefined } = _.mapValues(mutators, (value: any, attrKeyPath: string) => {
            const immutableValue: any = immutable.fromJS(value);
            const attrKeyPathElements: string[] = attrKeyPath.split('.');
            const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
            alteredRecordData = alteredRecordData.setIn(attrKeyPathElements, immutableValue);
            return oldValue;
        });
        this.RECORD_DATA = alteredRecordData;
        const subscribersPromise: Promise<any> = this.subscriptionsWrapper.triggerSubscribersForMultipleAttrs(mutatorsKeys);
        return {oldValues, subscribersPromise};
    }

    deleteAttr(attrKeyPath: string): { subscribersPromise: Promise<any> } {
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
        const subscribersPromise: Promise<any> = this.subscriptionsWrapper.triggerSubscribersForAttr(attrKeyPath);
        return {subscribersPromise};
    }

    removeAttr(attrKeyPath: string): { oldValue: any | undefined, subscribersPromise: Promise<any> } {
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
        const subscribersPromise: Promise<any> = this.subscriptionsWrapper.triggerSubscribersForAttr(attrKeyPath);
        return {oldValue, subscribersPromise};
    }
}