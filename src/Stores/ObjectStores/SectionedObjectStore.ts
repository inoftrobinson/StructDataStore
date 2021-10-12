import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../DataProcessors";
import BaseObjectStore, {BaseObjectProps} from "./BaseObjectStore";
import {MapModel} from "../../ModelsFields";
import ImmutableRecordWrapper from "../../ImmutableRecordWrapper";
import {ObjectFlattenedRecursiveMutatorsResults, ObjectOptionalFlattenedRecursiveMutators} from "../../types";


export interface SectionedObjectFieldProps extends BaseObjectProps {
    objectModel: MapModel;
    retrieveItemCallable: (key: string) => Promise<any>;
    retrieveMultipleItemsCallable?: (keys: string[]) => Promise<any>;
    onItemRetrievalFailure?: (responseData: any) => any;
}

export default class SectionedObjectStore<T extends { [p: string]: any }> extends BaseObjectStore<T> {
    public RECORD_WRAPPERS: { [key: string]: ImmutableRecordWrapper<T[keyof T]> };
    private readonly pendingKeyItemsRetrievalPromises: { [key: string]: Promise<ImmutableRecordWrapper<T[keyof T]> | null> };

    constructor(public readonly props: SectionedObjectFieldProps) {
        super(props);
        this.RECORD_WRAPPERS = {};
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
        Promise<{ dataWrapper: ImmutableRecordWrapper<T[keyof T]> | null, relativeAttrKeyPath: F.AutoPath<T[keyof T], P> | null }>
    ) {
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        const dataWrapper: ImmutableRecordWrapper<T[keyof T]> | null = await this.getDataItem(itemKey);
        return {dataWrapper, relativeAttrKeyPath};
    }

    makeRecordDataWrapperFromItem(recordKey: string, recordItem: immutable.RecordOf<T[keyof T]>): ImmutableRecordWrapper<T[keyof T]> {
        return new ImmutableRecordWrapper<T[keyof T]>(recordItem, this.props.objectModel.props.fields[recordKey] as MapModel);
    }

    makeRecordWrapperFromData(recordKey: string, recordData: T[keyof T]): ImmutableRecordWrapper<T[keyof T]> | null {
        const recordItem: immutable.RecordOf<T[keyof T]> | null = loadObjectDataToImmutableValuesWithFieldsModel<T[keyof T]>(
            recordData, this.props.objectModel.props.fields[recordKey] as MapModel
        );
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordKey, recordItem) : null;
    }

    makeRegisterRecordWrapperFromData(recordKey: string, recordData: T[keyof T]): ImmutableRecordWrapper<T[keyof T]> | null {
        const recordWrapper = this.makeRecordWrapperFromData(recordKey, recordData);
        if (recordWrapper != null) {
            this.RECORD_WRAPPERS[recordKey] = recordWrapper;
        }
        return recordWrapper;
    }

    /*
        loadRecordsFromData(recordsData: { [recordId: string]: T }): {
        records: { [key: string]: immutable.RecordOf<T> | undefined }, subscribersPromise: Promise<any>
    } {
        const recordsDataWrappers: { [key: string]: ImmutableRecordWrapper<T> } = _.transform(
            recordsData,
            (result: { [key: string]: ImmutableRecordWrapper<T> }, itemData: T, key: string) => {
                result[key] = this.makeRegisterRecordWrapperFromData(key, itemData)
            },
            {}
        );
        this.CACHED_RECORDS_DATA_WRAPPERS = recordsDataWrappers;
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        const records = _.mapValues(recordsDataWrappers, (recordDataWrapperItem: ImmutableRecordWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
        return {records, subscribersPromise};
    }
     */

    loadFromData(data: T): { subscribersPromise: Promise<any> } {
        const recordWrappers: { [key: string]: ImmutableRecordWrapper<T[keyof T]> } = _.transform(
            data, (result: {}, itemData: T[keyof T], key: string) => {
                result[key] = this.makeRecordWrapperFromData(key, itemData)
            }, {}
        );
        this.RECORD_WRAPPERS = recordWrappers;
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        // const records = _.mapValues(recordsDataWrappers, (recordDataWrapperItem: ImmutableRecordWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
        return {subscribersPromise};
    }

    retrieveAndCacheRecordItem(recordKey: string): Promise<ImmutableRecordWrapper<T[keyof T]> | null>  {
        const existingPendingPromise: Promise<ImmutableRecordWrapper<T[keyof T]> | null> | undefined = this.pendingKeyItemsRetrievalPromises[recordKey];
        if (existingPendingPromise !== undefined) {
            return existingPendingPromise;
        } else {
            const retrievalPromise: Promise<ImmutableRecordWrapper<T[keyof T]> | null> = (
                this.props.retrieveItemCallable(recordKey).then(responseData => {
                    delete this.pendingKeyItemsRetrievalPromises[recordKey];
                    if (responseData.success === true && responseData.data !== undefined) {
                        const recordWrapper: ImmutableRecordWrapper<T[keyof T]> | null = this.makeRegisterRecordWrapperFromData(
                            recordKey, responseData.data as T[keyof T]
                        );
                        if (recordWrapper != null) {
                            this.RECORD_WRAPPERS[recordKey] = recordWrapper;
                            this.triggerSubscribers();
                            // this.triggerSubscribersForKey(recordKey);
                            return recordWrapper;
                        }
                    }
                    this.props.onItemRetrievalFailure?.(responseData);
                    this.triggerSubscribers();
                    // this.triggerSubscribersForKey(recordKey);
                    return null;
                })
            );
            this.pendingKeyItemsRetrievalPromises[recordKey] = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getDataItem(key: string): Promise<ImmutableRecordWrapper<T[keyof T]> | null> {
        return this.RECORD_WRAPPERS[key] !== undefined ? this.RECORD_WRAPPERS[key] : this.retrieveAndCacheRecordItem(key);
    }

    async retrieveAndCacheMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: ImmutableRecordWrapper<T[keyof T]> | null }>  {
        const keysRequiringRetrieval: string[] = [];
        const keysPromises: Promise<{ key: string, record: ImmutableRecordWrapper<T[keyof T]> | null }>[] = [];
        recordKeys.forEach((key: string) => {
            const existingKeyPendingPromise: Promise<ImmutableRecordWrapper<T[keyof T]> | null> | undefined = this.pendingKeyItemsRetrievalPromises[key];
            if (existingKeyPendingPromise !== undefined) {
                keysPromises.push(existingKeyPendingPromise.then((record: ImmutableRecordWrapper<T[keyof T]> | null) => ({key, record})));
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            if (this.props.retrieveMultipleItemsCallable !== undefined) {
                const baseMultiItemsRetrievalPromise = this.props.retrieveMultipleItemsCallable(keysRequiringRetrieval);
                keysRequiringRetrieval.forEach((recordKey: string) => {
                    const keyItemRetrievalPromise: Promise<ImmutableRecordWrapper<T[keyof T]> | null> = baseMultiItemsRetrievalPromise.then(responseData => {
                        delete this.pendingKeyItemsRetrievalPromises[recordKey];
                        if (responseData.success === true && responseData.data !== undefined) {
                            const itemsDataContainer: { [itemKey: string]: { [attrKey: string]: any } } = responseData.data;
                            const itemData: { [attrKey: string]: any } | undefined = itemsDataContainer[recordKey];
                            if (itemData !== undefined) {
                                const recordWrapper: ImmutableRecordWrapper<T[keyof T]> | null = (
                                    this.makeRecordWrapperFromData(recordKey, itemData as T[keyof T])
                                );
                                if (recordWrapper != null) {
                                    this.RECORD_WRAPPERS[recordKey] = recordWrapper;
                                    // this.triggerSubscribersForKey(recordKey);
                                    this.triggerSubscribersForAttr(recordKey);
                                    return recordWrapper;
                                }
                            }
                        }
                        this.props.onItemRetrievalFailure?.(responseData);
                        // this.triggerSubscribersForKey(recordKey);
                        this.triggerSubscribersForAttr(recordKey);
                        return null;
                    });
                    this.pendingKeyItemsRetrievalPromises[recordKey] = keyItemRetrievalPromise;
                    keysPromises.push(keyItemRetrievalPromise.then((record: ImmutableRecordWrapper<T[keyof T]> | null) => ({key: recordKey, record})));
                });
            } else if (this.props.retrieveItemCallable !== undefined) {
                // todo: if retrieveMultipleItemsCallable is not defined, use the retrieveItemCallable
                //  callable multiple times asynchronously to retrieve the multiple records
            } else {
                console.error('retrieveMultipleItemsCallable or retrieveItemCallable must be defined');
            }
        }
        const keysContainers: { key: string, record: ImmutableRecordWrapper<T[keyof T]> | null }[] = await Promise.all(keysPromises);
        this.triggerSubscribers();
        return _.transform(keysContainers, (result: { [key: string]: any }, container: { key: string, record: ImmutableRecordWrapper<T[keyof T]> | null }) => {
            result[container.key] = container.record;
        }, {});
    }

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: ImmutableRecordWrapper<T[keyof T]> | null }> {
        const keysRequiringRetrieval: string[] = [];
        const existingItemsDataWrappers: { [key: string]: ImmutableRecordWrapper<T[keyof T]> } = {};
        recordKeys.forEach((key: string) => {
            const existingRecordDataWrapper: ImmutableRecordWrapper<T[keyof T]> | undefined = this.RECORD_WRAPPERS[key];
            if (existingRecordDataWrapper !== undefined) {
                existingItemsDataWrappers[key] = existingRecordDataWrapper;
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            const retrievedRecordsItems: { [key: string]: ImmutableRecordWrapper<T[keyof T]> | null} = (
                await this.retrieveAndCacheMultipleRecordItems(keysRequiringRetrieval)
            );
            return {...existingItemsDataWrappers, ...retrievedRecordsItems};
        } else {
            return existingItemsDataWrappers;
        }
    }

    async getRecordItem(key: string): Promise<ImmutableRecordWrapper<T[keyof T]> | null> {
        return this.RECORD_WRAPPERS[key] !== undefined ? this.RECORD_WRAPPERS[key] : this.retrieveAndCacheRecordItem(key);
    }

    async getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<O.Path<T, S.Split<P, '.'>> | undefined> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                return dataWrapper.getAttr(relativeAttrKeyPath);
            } else {
                // todo: update entire attr wrapper, maybe add a case of updateAttr in the
                //  dataWrapper, where if an empty string is passed, the root object is updated ?
            }
        }
        return undefined;
    }

    private makeAttrsRelativeKeyPathsByItemsKeys<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } {
        return _.transform(attrsKeyPaths, (output: {}, attrKeyPath: F.AutoPath<T, P>) => {
            const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
            if (relativeAttrKeyPath != null) {
                const existingContainer: F.AutoPath<T[keyof T], P>[] | undefined = output[itemKey];
                if (existingContainer !== undefined) {
                    existingContainer.push(relativeAttrKeyPath);
                } else {
                    output[itemKey] = [relativeAttrKeyPath];
                }
            } else {
                // todo: handle null relativeAttrKeyPath
            }
        }, {});
    }

    private makeAttrsRelativeMutatorsByItemsKeys<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): { [itemKey: string]: { [relativeAttrKeyPath: string]: any } } {
        return _.transform(mutators, (output: {}, mutatorValue: any, mutatorAttrKeyPath: string) => {
            const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(mutatorAttrKeyPath as F.AutoPath<T, any>);
            if (relativeAttrKeyPath != null) {
                const existingContainer: {} | undefined = output[itemKey];
                if (existingContainer !== undefined) {
                    existingContainer[relativeAttrKeyPath as string] = mutatorValue;
                } else {
                    output[itemKey] = {[relativeAttrKeyPath as string]: mutatorValue};
                }
            } else {
                // todo: add support for null relativeAttrKeyPath
            }
        }, {});
    }

    async getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<O.Optional<U.Merge<O.P.Pick<T, S.Split<P, ".">>>>> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const retrievedValues: { [attrKeyPath: string]: any } = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: {}, relativeAttrsKeysPathsToRetrieve: F.AutoPath<T[keyof T], P>[], itemKey: string) => {
                const matchingDataWrapper: ImmutableRecordWrapper<T[keyof T]> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const retrievedAttributes = matchingDataWrapper.getMultipleAttrs(relativeAttrsKeysPathsToRetrieve);
                    _.forEach(retrievedAttributes, (attrRetrievedValue: any, relativeAttrKeyPath: string) => {
                        const absoluteAttrKeyPath: string = `${itemKey}.${relativeAttrKeyPath}`;
                        result[absoluteAttrKeyPath] = attrRetrievedValue;
                    });
                }
            }, {}
        );
        return retrievedValues as U.Merge<O.P.Pick<T, S.Split<P, ".">>>;
    }

    async updateAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                const oldValue: O.Path<T, S.Split<P, '.'>> | undefined = dataWrapper.updateAttr(relativeAttrKeyPath, value);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
                return {oldValue, subscribersPromise};
            } else {
                // todo: handle null relativeAttrKeyPath
            }
        }
        return {oldValue: undefined, subscribersPromise: new Promise(resolve => resolve(undefined))};
    }

    async updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined; subscribersPromise: Promise<any> }> {
        const attrsRelativeMutatorsByItemsKeys: { [itemKey: string]: { [relativeAttrKeyPath: string]: any } } = (
            this.makeAttrsRelativeMutatorsByItemsKeys<M>(mutators)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeMutatorsByItemsKeys))
        );
        const collectedOldValues: { [attrKey: string]: any } = _.transform(attrsRelativeMutatorsByItemsKeys,
            (result: {}, relativeMutatorsToExecute: { [relativeAttrKeyPath: string]: any }, itemKey: string) => {
                const matchingDataWrapper: ImmutableRecordWrapper<T[keyof T]> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const oldValues: { [relativeAttrKeyPath: string]: any } = matchingDataWrapper.updateMultipleAttrs(relativeMutatorsToExecute);
                    _.forEach(oldValues, (attrOldValue: any, relativeAttrKeyPath: string) => {
                        const absoluteAttrKeyPath: string = `${itemKey}.${relativeAttrKeyPath}`;
                        result[absoluteAttrKeyPath] = attrOldValue;
                    });
                }
            }, {}
        );
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(Object.keys(mutators));
        return {oldValues: collectedOldValues as ObjectFlattenedRecursiveMutatorsResults<T, M>, subscribersPromise};
    }

    async updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        // todo: implement
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async updateDataToMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined; subscribersPromise: Promise<any> }> {
        // todo: implement
        return {oldValues: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                dataWrapper.deleteAttr(relativeAttrKeyPath);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
                return {subscribersPromise};
            } else {
                // todo: handle null relativeAttrKeyPath
            }
        }
        return {subscribersPromise: new Promise(resolve => resolve(undefined))};
    }

    async deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        _.forEach(attrsRelativeKeyPathsByItemsKeys, (relativeAttrsKeysPathsToDelete: F.AutoPath<T[keyof T], P>[], itemKey: string) => {
            const matchingDataWrapper: ImmutableRecordWrapper<T[keyof T]> | null = dataWrappers[itemKey];
            if (matchingDataWrapper != null) {
                matchingDataWrapper.deleteMultipleAttrs(relativeAttrsKeysPathsToDelete);
            }
        });
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
        return {subscribersPromise};
    }

    async removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                const oldValue: O.Path<T, S.Split<P, '.'>> | undefined = dataWrapper.removeAttr(relativeAttrKeyPath);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
                return {oldValue, subscribersPromise};
            } else {
                // todo: handle null relativeAttrKeyPath
            }
        }
        return {oldValue: undefined, subscribersPromise: new Promise(resolve => resolve(undefined))};
    }

    async removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ removedValues: U.Merge<O.P.Pick<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T[keyof T], P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T[keyof T]> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const collectedOldValues: { [removedAttrKeyPath: string]: any } = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: {}, relativeAttrsKeysPathsToRemove: F.AutoPath<T[keyof T], P>[], itemKey: string) => {
                const matchingDataWrapper: ImmutableRecordWrapper<T[keyof T]> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const oldValues = matchingDataWrapper.removeMultipleAttrs(relativeAttrsKeysPathsToRemove);
                    _.forEach(oldValues, (attrOldValue: any, relativeAttrKeyPath: string) => {
                        const absoluteAttrKeyPath: string = `${itemKey}.${relativeAttrKeyPath}`;
                        result[absoluteAttrKeyPath] = attrOldValue;
                    });
                }
            }, {}
        );
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
        return {removedValues: collectedOldValues as U.Merge<O.P.Pick<T, S.Split<P, ".">>>, subscribersPromise};
    }
}