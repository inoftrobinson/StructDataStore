import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "./DataProcessors";
import {MapModel} from "./ModelsFields";
import BaseObjectStoreV2 from "./Stores/ObjectStores/BaseObjectStoreV2";


export default class ImmutableRecordWrapper<T> {
    constructor(
        public readonly parentStore: BaseObjectStoreV2<T>,
        public RECORD_DATA: immutable.RecordOf<T>,
        public readonly itemModel: MapModel
    ) {
    }

    static fromRecord<T extends {}>(parentStore: BaseObjectStoreV2<T>, itemModel: MapModel, record: immutable.RecordOf<T>) {
        return new ImmutableRecordWrapper<T>(parentStore, record, itemModel);
    }

    static fromData<T>(parentStore: BaseObjectStoreV2<T>, itemModel: MapModel, data: T) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
        return new ImmutableRecordWrapper<T>(parentStore, record, itemModel);
    }

    static fromEmpty<T>(parentStore: BaseObjectStoreV2<T>, itemModel: MapModel) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel({}, itemModel) as immutable.RecordOf<T>;
        return new ImmutableRecordWrapper<T>(parentStore, record, itemModel);
    }

    /*static fromNull<T>(parentStore: BaseObjectStoreV2<T>) {
        return new ImmutableRecordWrapper<T>(parentStore);
    }*/

    updateRecord(record:immutable.RecordOf<T> | null): { subscribersPromise: Promise<any> } {
        this.RECORD_DATA = record;
        const subscribersPromise: Promise<any> = this.parentStore.subscriptionsManager.triggerAllSubscribers();
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

    /*
    declare function get<Obj extends object, P extends string>(
    object: Obj, path: F.AutoPath<Obj, P>
): O.Path<Obj, S.Split<P, '.'>>
     */
    get<P extends string>(path: F.AutoPath<T, P>): O.Path<T, S.Split<P, '.'>> {
        return 0 as any;
    }

    getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): O.Path<T, S.Split<P, '.'>> {
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        return this.RECORD_DATA.getIn(attrKeyPathElements);
    }

    getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): U.Merge<O.P.Pick<T, S.Split<P, ".">>> {
        const retrievedValues: U.Merge<O.P.Pick<T, S.Split<P, ".">>> = _.transform(attrsKeyPaths, (output: {}, attrKeyPath: F.AutoPath<T, P>) => {
            const attrKeyPathElements: string[] = attrKeyPath.split('.');
            output[attrKeyPath] = this.RECORD_DATA.getIn(attrKeyPathElements);
        }, {});
        return retrievedValues;
    }

    updateAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>, value: any): O.Path<T, S.Split<P, '.'>> | undefined {
        const immutableValue: any = immutable.fromJS(value);
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.setIn(attrKeyPathElements, immutableValue);
        return oldValue;
    }

    updateMultipleAttrs<T extends { [attrKeyPath: string]: any }>(mutators: Partial<T>): IterableIterator<[keyof T, T[keyof T]]> {
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
        return oldValues;
    }

    deleteAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): void {
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
    }

    deleteMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): void {
        if (!(attrsKeyPaths.length > 0)) {
            return {oldValues: {}, subscribersPromise: new Promise(resolve => resolve())};
        }
        /*
        // todo: move to a mergeDeep of mutators instead of the repeated call to deleteIn
        map.mergeDeep
        const mutators = _.transform(attrsKeyPaths, (result: {}, attrKeyPath: F.AutoPath<T, P>) => {
            const attrKeyPathElements: string[] = attrKeyPath.split('.');
            result[attrKeyPath] = undefined;
            let container = result;
            _.forEach(attrKeyPathElements, (attrKeyPathPart: string) => {
                const existingSubContainer: {} | undefined = container[attrKeyPathPart];
                if (existingSubContainer === undefined) {
                    const newSubContainer = {};
                    container[attrKeyPathPart] = newSubContainer;
                    container = newSubContainer;
                } else {
                    container = existingSubContainer;
                }
            });
        }, {});
         */
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        _.forEach(attrsKeyPaths, (attrKeyPath: F.AutoPath<T, P>) => {
            const attrKeyPathElements: string[] = attrKeyPath.split('.');
            alteredRecordData = alteredRecordData.deleteIn(attrKeyPathElements);
        });
        this.RECORD_DATA = alteredRecordData;
    }

    removeAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): O.Path<T, S.Split<P, '.'>> | undefined {
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
        return oldValue;
    }

    removeMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): U.Merge<O.P.Pick<T, S.Split<P, ".">>> | undefined {
        if (!(attrsKeyPaths.length > 0)) {
            return {oldValues: {}, subscribersPromise: new Promise(resolve => resolve())};
        }
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [attrKeyPath: string]: any | undefined } = _.transform(attrsKeyPaths, (result: {}, attrKeyPath: string) => {
            const attrKeyPathElements: string[] = attrKeyPath.split('.');
            const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
            alteredRecordData = alteredRecordData.deleteIn(attrKeyPathElements, immutableValue);
            return oldValue;
        });
        this.RECORD_DATA = alteredRecordData;
        return oldValues;
    }
}