import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "./DataProcessors";
import {MapModel} from "./ModelsFields";
import {BaseObjectStore} from "./Stores/ObjectStores/BaseObjectStore";
import {
    separateAttrKeyPath,
    separateAttrKeyPathWithQueryKwargs,
    separatePotentialGetterWithQueryKwargs
} from "../utils/attrKeyPaths";


export default class RecordDataWrapper<T> {
    constructor(
        public readonly parentStore: BaseObjectStore<T>,
        public RECORD_DATA: immutable.RecordOf<T>,
        public readonly itemModel: MapModel
    ) {
    }

    static fromRecord<T>(parentStore: BaseObjectStore<T>, itemModel: MapModel, record:immutable.RecordOf<T>) {
        return new RecordDataWrapper<T>(parentStore, record, itemModel);
    }

    static fromData<T>(parentStore: BaseObjectStore<T>, itemModel: MapModel, data: T) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
        return new RecordDataWrapper<T>(parentStore, record, itemModel);
    }

    static fromEmpty<T>(parentStore: BaseObjectStore<T>, itemModel: MapModel) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel({}, itemModel) as immutable.RecordOf<T>;
        return new RecordDataWrapper<T>(parentStore, record, itemModel);
    }

    /*static fromNull<T>(parentStore: BaseObjectStore<T>) {
        return new RecordDataWrapper<T>(parentStore);
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
        const matchingFieldItem: MapModel | BasicFieldModel | TypedDictFieldModel | undefined = itemMapModel.props.fields[firstKeyPathElement];
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
            const matchingFieldItem: MapModel | BasicFieldModel | TypedDictFieldModel | undefined = currentItemMapModel.props.fields[keyPathElement];
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

    getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }): O.Path<T, S.Split<P, '.'>> {
        const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath, queryKwargs);
        return this.RECORD_DATA.getIn(attrKeyPathElements);
    }

    getMultipleAttrs<P extends string>(
        getters: (F.AutoPath<T, P> | {attrKeyPath: F.AutoPath<T, P>, queryKwargs: { [argKey: string]: any }})[]
    ): U.Merge<O.P.Pick<T, S.Split<P, ".">>>;
    getMultipleAttrs<P extends string>(
        getters: { [getterKey: string]: (F.AutoPath<T, P> | {attrKeyPath: F.AutoPath<T, P>, queryKwargs: { [argKey: string]: any }}) }
    ): U.Merge<O.P.Pick<T, S.Split<P, ".">>> {
        type GetterItem = {attrKeyPath: F.AutoPath<T, P>, queryKwargs: { [argKey: string]: string }};
        const retrievedValues: U.Merge<O.P.Pick<T, S.Split<P, '.'>>> = (
            _.isArray(getters) ? _.transform(
                getters, (output: { [renderedAttrKeyPath: string]: any }, getterItem: F.AutoPath<T, P> | GetterItem) => {
                    const attrKeyPathElements: string[] = separatePotentialGetterWithQueryKwargs(getterItem);
                    const renderedAttrKeyPath: string = attrKeyPathElements.join('.');
                    output[renderedAttrKeyPath] = this.RECORD_DATA.getIn(attrKeyPathElements);
                }, {}
            ) : _.isPlainObject(getters) ? _.transform(
                getters, (output: { [getterKey: string]: any }, getterItem: F.AutoPath<T, P> | GetterItem, getterKey: string) => {
                    const attrKeyPathElements: string[] = separatePotentialGetterWithQueryKwargs(getterItem);
                    output[getterKey] = this.RECORD_DATA.getIn(attrKeyPathElements);
                }, {}
            ) : (() => {
                console.error('getters were not an array or an object, and could not be used.');
                console.error(getters);
                return {} as any;
            })()
        ) as any;
        return retrievedValues;
    }

    getMultipleAttrsV2<P extends string>(
        getters: { [getterKey: string]: (F.AutoPath<T, P>) }
    ): U.Merge<O.P.Pick<T, S.Split<P, ".">>> {
        const retrievedValues: U.Merge<O.P.Pick<T, S.Split<P, ".">>> = _.transform(
            getters, (output: {}, getterItem: F.AutoPath<T, P> | {attrKeyPath: F.AutoPath<T, P>, queryKwargs: { [argKey: string]: string }}, getterKey: string) => {
                const attrKeyPathElements: string[] = separatePotentialGetterWithQueryKwargs(getterItem);
                output[getterKey as unknown as string] = this.RECORD_DATA.getIn(attrKeyPathElements);
            }, {}
        );
        return retrievedValues;
    }

    updateAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>, value: any, queryKwargs: { [argKey: string]: any }): {
        oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any>
    } {
        const immutableValue: any = immutable.fromJS(value);
        const attrKeyPathElements: string[] = separateAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.setIn(attrKeyPathElements, immutableValue);
        const subscribersPromise = this.parentStore.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
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
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
            const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
            alteredRecordData = alteredRecordData.setIn(attrKeyPathElements, immutableValue);
            return oldValue;
        });
        this.RECORD_DATA = alteredRecordData;
        const subscribersPromise: Promise<any> = this.parentStore.subscriptionsManager.triggerSubscribersForMultipleAttrs(mutatorsKeys);
        return {oldValues, subscribersPromise};
    }

    deleteAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): { subscribersPromise: Promise<any> } {
        const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
        const subscribersPromise: Promise<any> = this.parentStore.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
        return {subscribersPromise};
    }

    deleteMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): { subscribersPromise: Promise<any> } {
        if (!(attrsKeyPaths.length > 0)) {
            return {oldValues: {}, subscribersPromise: new Promise(resolve => resolve())};
        }
        /*
        // todo: move to a mergeDeep of mutators instead of the repeated call to deleteIn
        map.mergeDeep
        const mutators = _.transform(attrsKeyPaths, (result: {}, attrKeyPath: F.AutoPath<T, P>) => {
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
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
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
            alteredRecordData = alteredRecordData.deleteIn(attrKeyPathElements);
        });
        this.RECORD_DATA = alteredRecordData;
        const subscribersPromise: Promise<any> = this.parentStore.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
        return {subscribersPromise};
    }

    removeAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): {
        oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any>
    } {
        const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
        const subscribersPromise: Promise<any> = this.parentStore.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
        return {oldValue, subscribersPromise};
    }

    removeMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): {
        oldValues: U.Merge<O.P.Pick<T, S.Split<P, ".">>> | undefined, subscribersPromise: Promise<any>
    } {
        if (!(attrsKeyPaths.length > 0)) {
            return {oldValues: {}, subscribersPromise: new Promise(resolve => resolve())};
        }
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [attrKeyPath: string]: any | undefined } = _.transform(attrsKeyPaths, (result: {}, attrKeyPath: string) => {
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
            const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
            alteredRecordData = alteredRecordData.deleteIn(attrKeyPathElements, immutableValue);
            return oldValue;
        });
        this.RECORD_DATA = alteredRecordData;
        const subscribersPromise: Promise<any> = this.parentStore.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
        return {oldValues, subscribersPromise};
    }
}