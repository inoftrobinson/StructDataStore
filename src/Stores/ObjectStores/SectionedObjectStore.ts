import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import RecordDataWrapper from "../../RecordDataWrapper";
import {BaseObjectProps} from "./BaseObjectStore";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../DataProcessors";
import BaseObjectStoreV2 from "./BaseObjectStoreV2";
import {MapModel} from "../../ModelsFields";


export interface SectionedObjectFieldProps extends BaseObjectProps {
    objectModel: MapModel;
    retrieveItemCallable: (key: string) => Promise<any>;
    retrieveMultipleItemsCallable?: (keys: string[]) => Promise<any>;
    onItemRetrievalFailure?: (responseData: any) => any;
}

export default class SectionedObjectStore<T extends { [p: string]: any }> extends BaseObjectStoreV2<T> {
    public CACHED_DATA_WRAPPERS: { [key: string]: RecordDataWrapper<T[keyof T]> };
    private readonly pendingKeyItemsRetrievalPromises: { [key: string]: Promise<immutable.RecordOf<T> | null> };

    constructor(public readonly props: SectionedObjectFieldProps) {
        super(props);
        this.CACHED_DATA_WRAPPERS = {};
        this.pendingKeyItemsRetrievalPromises = {};
    }

    private makeRelativeAttrKeyPath<P extends string>(attrKeyPath: F.AutoPath<T, P>): {
        itemKey: string, relativeAttrKeyPath: F.AutoPath<T[keyof T], P> | null
    } {
        const attrKeyPathParts: string[] = attrKeyPath.split('.');
        const relativeAttrKeyPath: F.AutoPath<T[keyof T], P> | null = (
            attrKeyPathParts.length > 1 ? attrKeyPathParts.slice(1).join('.') as F.AutoPath<T[keyof T], P> : null
        );
        return {itemKey: attrKeyPathParts[0], relativeAttrKeyPath};
    }

    protected async getMatchingDataWrapper<P extends string>(attrKeyPath: F.AutoPath<T, P>): (
        Promise<{ dataWrapper: RecordDataWrapper<T[keyof T]>, relativeAttrKeyPath: F.AutoPath<T[keyof T], P> | null }>
    ) {
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        const dataWrapper: RecordDataWrapper<T[keyof T]> | null = await this.getDataItem(itemKey);
        return {dataWrapper, relativeAttrKeyPath};
    }

    makeRecordDataWrapperFromItem(recordKey: string, recordItem: immutable.RecordOf<T[keyof T]>): RecordDataWrapper<T[keyof T]> {
        return new RecordDataWrapper<T[keyof T]>(this, recordItem, this.props.objectModel.props.fields[recordKey]);
    }

    makeRecordDataWrapperFromData(recordKey: string, recordData: T): RecordDataWrapper<T> | null {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
            recordData, this.props.objectModel.props.fields[recordKey]
        ) as immutable.RecordOf<T>;
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordKey, recordItem) : null;
    }

    /*
        loadRecordsFromData(recordsData: { [recordId: string]: T }): {
        records: { [key: string]: immutable.RecordOf<T> | undefined }, subscribersPromise: Promise<any>
    } {
        const recordsDataWrappers: { [key: string]: RecordDataWrapper<T> } = _.transform(
            recordsData,
            (result: { [key: string]: RecordDataWrapper<T> }, itemData: T, key: string) => {
                result[key] = this.makeRecordDataWrapperFromData(key, itemData)
            },
            {}
        );
        this.CACHED_RECORDS_DATA_WRAPPERS = recordsDataWrappers;
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        const records = _.mapValues(recordsDataWrappers, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
        return {records, subscribersPromise};
    }
     */

    loadFromData(data: T): { item: immutable.RecordOf<T> | undefined; subscribersPromise: Promise<any> } {
        const dataWrappers: { [key: string]: RecordDataWrapper<T[keyof T]> } = _.transform(
            data, (result: {}, itemData: T, key: string) => {
                result[key] = this.makeRecordDataWrapperFromData(key, itemData)
            }, {}
        );
        this.CACHED_DATA_WRAPPERS = dataWrappers;
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        // const records = _.mapValues(recordsDataWrappers, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
        return {dataWrappers, subscribersPromise};
    }

    retrieveAndCacheRecordItem(recordKey: string): Promise<RecordDataWrapper<T[keyof T]> | null>  {
        const existingPendingPromise: Promise<RecordDataWrapper<T[keyof T]> | null> | undefined = this.pendingKeyItemsRetrievalPromises[recordKey];
        if (existingPendingPromise !== undefined) {
            return existingPendingPromise;
        } else {
            const retrievalPromise: Promise<RecordDataWrapper<T[keyof T]> | null> = (
                this.props.retrieveItemCallable(recordKey).then(responseData => {
                    delete this.pendingKeyItemsRetrievalPromises[recordKey];
                    if (responseData.success === true && responseData.data !== undefined) {
                        const recordDataWrapper: RecordDataWrapper<T[keyof T]> = this.makeRecordDataWrapperFromData(
                            recordKey, responseData.data as T
                        );
                        this.internalCreateUpdateRecordItem(recordKey, recordDataWrapper.RECORD_DATA);

                        this.triggerSubscribers();
                        // this.triggerSubscribersForKey(recordKey);
                        return recordDataWrapper;
                    } else {
                        this.props.onItemRetrievalFailure?.(responseData);
                        this.triggerSubscribers();
                        // this.triggerSubscribersForKey(recordKey);
                        return null;
                    }
                })
            );
            this.pendingKeyItemsRetrievalPromises[recordKey] = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getDataItem(key: string): Promise<RecordDataWrapper<T[keyof T]> | null> {
        return this.CACHED_DATA_WRAPPERS[key] !== undefined ? this.CACHED_DATA_WRAPPERS[key] : this.retrieveAndCacheRecordItem(key);
    }

    protected internalCreateUpdateRecordItem(recordKey: string, recordItem: immutable.RecordOf<T>): immutable.RecordOf<T> | undefined {
        const existingRecordDataWrapper: RecordDataWrapper<T> | undefined = this.CACHED_DATA_WRAPPERS[recordKey];
        this.CACHED_DATA_WRAPPERS[recordKey] = this.makeRecordDataWrapperFromItem(recordKey, recordItem);
        return existingRecordDataWrapper?.RECORD_DATA;
    }

    async retrieveAndCacheMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: immutable.RecordOf<T[keyof T]> | null }>  {
        const keysRequiringRetrieval: string[] = [];
        const keysPromises: Promise<{ key: string, record: immutable.RecordOf<T[keyof T]> | null }>[] = [];
        recordKeys.forEach((key: string) => {
            const existingKeyPendingPromise: Promise<immutable.RecordOf<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[key];
            if (existingKeyPendingPromise !== undefined) {
                keysPromises.push(existingKeyPendingPromise.then((record: immutable.RecordOf<T[keyof T]> | null) => ({key, record})));
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            const baseMultiItemsRetrievalPromise = this.props.retrieveMultipleItemsCallable(keysRequiringRetrieval);
            keysRequiringRetrieval.forEach((recordKey: string) => {
                const keyItemRetrievalPromise: Promise<immutable.RecordOf<T[keyof T]> | null> = baseMultiItemsRetrievalPromise.then(responseData => {
                    delete this.pendingKeyItemsRetrievalPromises[recordKey];
                    if (responseData.success === true && responseData.data !== undefined) {
                        const itemsDataContainer: { [itemKey: string]: { [attrKey: string]: any } } = responseData.data;
                        const itemData: { [attrKey: string]: any } | undefined = itemsDataContainer[recordKey];
                        if (itemData !== undefined) {
                            const recordDataWrapper: RecordDataWrapper<T[keyof T]> = (
                                this.makeRecordDataWrapperFromData(recordKey, itemData as T[keyof T])
                            );
                            this.internalCreateUpdateRecordItem(recordKey, recordDataWrapper.RECORD_DATA);
                            // this.triggerSubscribersForKey(recordKey);
                            this.triggerSubscribersForAttr(recordKey);
                            return recordDataWrapper;
                        }
                    }
                    this.props.onItemRetrievalFailure?.(responseData);
                    // this.triggerSubscribersForKey(recordKey);
                    this.triggerSubscribersForAttr(recordKey);
                    return null;
                });
                this.pendingKeyItemsRetrievalPromises[recordKey] = keyItemRetrievalPromise;
                keysPromises.push(keyItemRetrievalPromise.then((record: immutable.RecordOf<T[keyof T]> | null) => ({key: recordKey, record})));
            });
        }
        const keysContainers: { key: string, record: immutable.RecordOf<T[keyof T]> | null }[] = await Promise.all(keysPromises);
        this.triggerSubscribers();
        return _.transform(keysContainers, (result: { [key: string]: any }, container: { key: string, record: immutable.RecordOf<T[keyof T]> | null }) => {
            result[container.key] = container.record;
        }, {});
    }

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: RecordDataWrapper<T[keyof T]> | null }> {
        const keysRequiringRetrieval: string[] = [];
        const existingItemsDataWrappers: { [key: string]: RecordDataWrapper<T[keyof T]> } = {};
        if (this.CACHED_DATA_WRAPPERS === undefined) {
            keysRequiringRetrieval.push(...recordKeys);
        } else {
            recordKeys.forEach((key: string) => {
                const existingRecordDataWrapper: RecordDataWrapper<T[keyof T]> | undefined = this.CACHED_DATA_WRAPPERS[key];
                if (existingRecordDataWrapper !== undefined) {
                    existingItemsDataWrappers[key] = existingRecordDataWrapper;
                } else {
                    keysRequiringRetrieval.push(key);
                }
            });
        }
        if (keysRequiringRetrieval.length > 0) {
            const retrievedRecordsItems: { [key: string]: immutable.RecordOf<T[keyof T]> | null} = (
                await this.retrieveAndCacheMultipleRecordItems(keysRequiringRetrieval)
            );
            return {...existingItemsDataWrappers, ...retrievedRecordsItems};
        } else {
            return existingItemsDataWrappers;
        }
    }

    async getRecordItem(key: string): Promise<immutable.RecordOf<T[keyof T]> | null> {
        return (this.CACHED_DATA_WRAPPERS[key] !== undefined ?
                this.CACHED_DATA_WRAPPERS[key].RECORD_DATA : this.retrieveAndCacheRecordItem(key)
        );
    }

    async getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<O.Path<T, S.Split<P, '.'>>> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (relativeAttrKeyPath != null) {
            return dataWrapper.getAttr<F.AutoPath<T[keyof T], P>>(relativeAttrKeyPath);
        } else {
            // todo: update entire attr wrapper, maybe add a case of updateAttr in the
            //  dataWrapper, where if an empty string is passed, the root object is updated ?
        }
    }

    private makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths: F.AutoPath<T, P>[]): { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } {
        return _.transform(attrsKeyPaths, (output: {}, attrKeyPath: F.AutoPath<T, P>) => {
            const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
            const existingContainer: string[] | undefined = output[itemKey];
            if (existingContainer !== undefined) {
                existingContainer.push(relativeAttrKeyPath);
            } else {
                output[itemKey] = [relativeAttrKeyPath];
            }
        }, {});
    }

    private makeAttrsRelativeMutatorsByItemsKeys(
        mutators: Partial<O.P.Pick<T, S.Split<P, '.'>>>
    ): { [itemKey: string]: Partial<O.P.Pick<T[keyof T], S.Split<P, '.'>>> } {
        return _.transform(mutators, (output: {}, mutatorValue: O.Path<T, S.Split<P, '.'>>, mutatorAttrKeyPath: F.AutoPath<T, P>) => {
            const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(mutatorAttrKeyPath);
            // todo: add support for null relativeAttrKeyPath
            const existingContainer: {} | undefined = output[itemKey];
            if (existingContainer !== undefined) {
                existingContainer[relativeAttrKeyPath] = mutatorValue;
            } else {
                output[itemKey] = {[relativeAttrKeyPath]: mutatorValue};
            }
        }, {});
    }

    async getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<U.Merge<O.P.Pick<T, S.Split<P, ".">>>> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: RecordDataWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const retrievedValues: U.Merge<O.P.Pick<T, S.Split<P, ".">>> = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: {}, relativeAttrsKeysPathsToRetrieve: F.AutoPath<T[keyof T], P>[], itemKey: string) => {
                const matchingDataWrapper: RecordDataWrapper<T[keyof T]> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const retrievedAttributes = matchingDataWrapper.getMultipleAttrs(relativeAttrsKeysPathsToRetrieve);
                    _.forEach(retrievedAttributes, (attrRetrievedValue: any, attrRelativeKeyPath: string) => {
                        const attrAbsoluteKeyPath: string = `${itemKey}.${attrRelativeKeyPath}`;
                        result[attrAbsoluteKeyPath] = attrRetrievedValue;
                    });
                }
            }, {}
        );
        return retrievedValues;
    }

    async updateAttrWithReturnedSubscribersPromise<P extends string>(attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>): (
        { oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }
    ) {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        return dataWrapper.updateAttr(relativeAttrKeyPath, value);
    }

    async updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        // todo: implement
        return null as any;
    }

    async updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        mutators: Partial<O.P.Pick<T, S.Split<P, '.'>>>
    ): Promise<{ oldValues: U.Merge<O.P.Pick<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const attrsRelativeMutatorsByItemsKeys: { [itemKey: string]: Partial<O.P.Pick<T[keyof T], S.Split<P, '.'>>> } = (
            this.makeAttrsRelativeMutatorsByItemsKeys(mutators)
        );
        const dataWrappers: { [itemKey: string]: RecordDataWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeMutatorsByItemsKeys))
        );
        const collectedSubscribersPromises: Promise<any>[] = [];
        const collectedOldValues: U.Merge<O.P.Pick<T, S.Split<P, ".">>> = _.transform(attrsRelativeMutatorsByItemsKeys,
            (result: {}, relativeMutatorsToExecute: Partial<O.P.Pick<T[keyof T], S.Split<P, '.'>>>, itemKey: string) => {
                const matchingDataWrapper: RecordDataWrapper<T[keyof T]> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const {oldValues, subscribersPromise} = matchingDataWrapper.updateMultipleAttrs(relativeMutatorsToExecute);
                    _.forEach(oldValues, (attrOldValue: any, attrRelativeKeyPath: string) => {
                        const attrAbsoluteKeyPath: string = `${itemKey}.${attrRelativeKeyPath}`;
                        result[attrAbsoluteKeyPath] = attrOldValue;
                    });
                    collectedSubscribersPromises.push(subscribersPromise);
                    return oldValues;
                }
            }, {}
        );
        const overallSubscribersPromise: Promise<any> = Promise.all(collectedSubscribersPromises);
        return {oldValues: collectedOldValues, subscribersPromise: overallSubscribersPromise};
    }

    async deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        return dataWrapper.deleteAttr(relativeAttrKeyPath);
    }

    async deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): (
        Promise<{ subscribersPromise: Promise<any> }>
    ) {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: RecordDataWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const collectedSubscribersPromises: Promise<any>[] = _.map(attrsRelativeKeyPathsByItemsKeys,
            (relativeAttrsKeysPathsToDelete: F.AutoPath<T[keyof T], P>[], itemKey: string) => {
                const matchingDataWrapper: RecordDataWrapper<T[keyof T]> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const {subscribersPromise} = matchingDataWrapper.deleteMultipleAttrs(relativeAttrsKeysPathsToDelete);
                    return subscribersPromise;
                }
            }
        );
        const overallSubscribersPromise: Promise<any> = Promise.all(collectedSubscribersPromises);
        return {subscribersPromise: overallSubscribersPromise};
    }

    async removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        return dataWrapper.removeAttr(relativeAttrKeyPath);
    }

    async removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ removedValues: U.Merge<O.P.Pick<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: RecordDataWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const collectedSubscribersPromises: Promise<any>[] = [];
        const collectedOldValues: U.Merge<O.P.Pick<T, S.Split<P, ".">>> = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: {}, relativeAttrsKeysPathsToRemove: F.AutoPath<T[keyof T], P>[], itemKey: string) => {
                const matchingDataWrapper: RecordDataWrapper<T[keyof T]> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const {oldValues, subscribersPromise} = matchingDataWrapper.removeMultipleAttrs(relativeAttrsKeysPathsToRemove);
                    _.forEach(oldValues, (attrOldValue: any, attrRelativeKeyPath: string) => {
                        const attrAbsoluteKeyPath: string = `${itemKey}.${attrRelativeKeyPath}`;
                        result[attrAbsoluteKeyPath] = attrOldValue;
                    });
                    collectedSubscribersPromises.push(subscribersPromise);
                    return oldValues;
                }
            }, {}
        );
        const overallSubscribersPromise = Promise.all(collectedSubscribersPromises);
        return {oldValues: collectedOldValues, subscribersPromise: overallSubscribersPromise};
    }
}