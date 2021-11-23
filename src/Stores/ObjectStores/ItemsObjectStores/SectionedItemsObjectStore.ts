import * as _ from 'lodash';
import * as immutable from 'immutable';
import ImmutableRecordWrapper from "../../../ImmutableRecordWrapper";
import {BaseItemsObjectStore, BaseItemsObjectStoreProps} from "./BaseItemsObjectStore";
import {BaseDataRetrievalPromiseResult} from "../../../models";
import {ImmutableCast} from "../../../types";


export type RetrieveSingleItemCallablePromiseResult<T> = BaseDataRetrievalPromiseResult<T>;
export type RetrieveMultipleItemsCallablePromiseResult<T> = BaseDataRetrievalPromiseResult<{ [itemKey: string]: T }>;

export interface SectionedItemsObjectStoreProps<T> extends BaseItemsObjectStoreProps {
    retrieveSingleItemCallable?: (key: string) => Promise<RetrieveSingleItemCallablePromiseResult<T>>;
    retrieveMultipleItemsCallable?: (keys: string[]) => Promise<RetrieveMultipleItemsCallablePromiseResult<T>>;
    onItemRetrievalFailure?: (metadata?: { [metadataKey: string]: any }) => any;
}

export class SectionedItemsObjectStore<T extends { [p: string]: any }> extends BaseItemsObjectStore<T> {
    public RECORD_WRAPPERS: { [key: string]: ImmutableRecordWrapper<T> };
    private pendingKeyItemsRetrievalPromises: { [key: string]: Promise<ImmutableRecordWrapper<T> | null> };

    constructor(public readonly props: SectionedItemsObjectStoreProps<T>) {
        super(props);
        this.RECORD_WRAPPERS = {};
        this.pendingKeyItemsRetrievalPromises = {};
    }

    loadFromDataWithReturnedSubscribersPromise(data: { [recordKey: string]: T }): { success: boolean; subscribersPromise: Promise<any> } {
        this.RECORD_WRAPPERS = this.recordsDataToWrappers(data);
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        return {success: true, subscribersPromise};
    }

    protected retrieveAndCacheSingleRecordWrapper(recordKey: string): Promise<ImmutableRecordWrapper<T> | null> {
        const existingPendingPromise: Promise<ImmutableRecordWrapper<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[recordKey];
        if (existingPendingPromise !== undefined) {
            return existingPendingPromise;
        } else {
            if (this.props.retrieveSingleItemCallable !== undefined) {
                const retrievalPromise: Promise<ImmutableRecordWrapper<T> | null> = (
                    this.props.retrieveSingleItemCallable(recordKey).then((result: RetrieveSingleItemCallablePromiseResult<T>) => {
                        const {success, data, metadata}: RetrieveSingleItemCallablePromiseResult<T> = result;
                        delete this.pendingKeyItemsRetrievalPromises[recordKey];
                        if (success && data != null) {
                            const recordWrapper: ImmutableRecordWrapper<T> | null = this.makeRecordWrapperFromData(recordKey, data);
                            if (recordWrapper != null) {
                                this.RECORD_WRAPPERS[recordKey] = recordWrapper;
                                this.triggerSubscribers();
                                // this.triggerSubscribersForKey(recordKey);
                                return recordWrapper;
                            }
                        }
                        this.props.onItemRetrievalFailure?.(metadata);
                        this.triggerSubscribers();
                        // this.triggerSubscribersForKey(recordKey);
                        return null;
                    })
                );
                this.pendingKeyItemsRetrievalPromises[recordKey] = retrievalPromise;
                return retrievalPromise;
            }  else if (this.props.retrieveMultipleItemsCallable !== undefined) {
                // todo: if retrieveSingleItemCallable is not defined, use the retrieveMultipleItemsCallable
                //  callable with pass of a single key with unpacking of its values to retrieve the multiple single record
            } else {
                console.error('retrieveMultipleItemsCallable or retrieveItemCallable must be defined');
            }
            return new Promise<ImmutableRecordWrapper<T> | null>(resolve => resolve(null));
        }
    }

    async retrieveAndCacheSingleRecord(recordKey: string): Promise<ImmutableCast<T> | null> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.retrieveAndCacheSingleRecordWrapper(recordKey);
        return recordWrapper != null ? recordWrapper.RECORD_DATA as ImmutableCast<T> : null;
    }

    protected async getSingleRecordWrapper(key: string): Promise<ImmutableRecordWrapper<T> | null> {
        return this.RECORD_WRAPPERS[key] !== undefined ? this.RECORD_WRAPPERS[key] : this.retrieveAndCacheSingleRecordWrapper(key);
    }

    protected async retrieveAndCacheMultipleRecordsWrappers(recordKeys: string[]): Promise<{ [key: string]: ImmutableRecordWrapper<T> | null }>  {
        const keysRequiringRetrieval: string[] = [];
        const keysPromises: Promise<{ key: string, record: ImmutableRecordWrapper<T> | null }>[] = [];
        recordKeys.forEach((key: string) => {
            const existingKeyPendingPromise: Promise<ImmutableRecordWrapper<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[key];
            if (existingKeyPendingPromise !== undefined) {
                keysPromises.push(existingKeyPendingPromise.then((record: ImmutableRecordWrapper<T> | null) => ({key, record})));
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            if (this.props.retrieveMultipleItemsCallable !== undefined) {
                const baseMultiItemsRetrievalPromise = this.props.retrieveMultipleItemsCallable(keysRequiringRetrieval);
                keysRequiringRetrieval.forEach((recordKey: string) => {
                    const keyItemRetrievalPromise: Promise<ImmutableRecordWrapper<T> | null> = (
                        baseMultiItemsRetrievalPromise.then((result: RetrieveMultipleItemsCallablePromiseResult<T>) => {
                            const {success, data, metadata}: RetrieveMultipleItemsCallablePromiseResult<T> = result;
                            delete this.pendingKeyItemsRetrievalPromises[recordKey];
                            if (success && data != null) {
                                const itemsDataContainer: { [itemKey: string]: { [attrKey: string]: any } } = data;
                                const itemData: { [attrKey: string]: any } | undefined = itemsDataContainer[recordKey];
                                if (itemData !== undefined) {
                                    const recordWrapper: ImmutableRecordWrapper<T> | null = (
                                        this.makeRecordWrapperFromData(recordKey, itemData as T)
                                    );
                                    if (recordWrapper != null) {
                                        this.RECORD_WRAPPERS[recordKey] = recordWrapper;
                                        // this.triggerSubscribersForKey(recordKey);
                                        this.subscriptionsManager.triggerSubscribersForAttr([recordKey]);
                                        return recordWrapper;
                                    }
                                }
                            }
                            this.props.onItemRetrievalFailure?.(metadata);
                            // this.triggerSubscribersForKey(recordKey);
                            this.subscriptionsManager.triggerSubscribersForAttr([recordKey]);
                            return null;
                        })
                    );
                    this.pendingKeyItemsRetrievalPromises[recordKey] = keyItemRetrievalPromise;
                    keysPromises.push(keyItemRetrievalPromise.then((record: ImmutableRecordWrapper<T> | null) => ({key: recordKey, record})));
                });
            } else if (this.props.retrieveSingleItemCallable !== undefined) {
                // todo: if retrieveMultipleItemsCallable is not defined, use the retrieveItemCallable
                //  callable multiple times asynchronously to retrieve the multiple records
            } else {
                console.error('retrieveMultipleItemsCallable or retrieveItemCallable must be defined');
            }
        }
        const keysContainers: { key: string, record: ImmutableRecordWrapper<T> | null }[] = await Promise.all(keysPromises);
        this.triggerSubscribers();
        return _.transform(keysContainers, (result: { [key: string]: any }, container: { key: string, record: ImmutableRecordWrapper<T> | null }) => {
            result[container.key] = container.record;
        }, {});
    }
    
    async retrieveAndCacheMultipleRecords(recordKeys: string[]): Promise<{ [key: string]: ImmutableCast<T> | null }>  {
        const recordsWrappers: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = await this.retrieveAndCacheMultipleRecordsWrappers(recordKeys);
        return _.mapValues(recordsWrappers, (recordWrapper: ImmutableRecordWrapper<T> | null) => {
            return recordWrapper != null ? recordWrapper.RECORD_DATA as ImmutableCast<T> : null;
        }); 
    }

    protected async getMultipleRecordsWrappers(recordKeys: string[]): Promise<{ [key: string]: ImmutableRecordWrapper<T> | null }> {
        const keysRequiringRetrieval: string[] = [];
        const existingItemsDataWrappers: { [key: string]: ImmutableRecordWrapper<T> } = {};
        recordKeys.forEach((key: string) => {
            const existingRecordDataWrapper: ImmutableRecordWrapper<T> | undefined = this.RECORD_WRAPPERS[key];
            if (existingRecordDataWrapper !== undefined) {
                existingItemsDataWrappers[key] = existingRecordDataWrapper;
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            const retrievedRecordsItems: { [key: string]: ImmutableRecordWrapper<T> | null} = (
                await this.retrieveAndCacheMultipleRecordsWrappers(keysRequiringRetrieval)
            );
            return {...existingItemsDataWrappers, ...retrievedRecordsItems};
        } else {
            return existingItemsDataWrappers;
        }
    }

    protected async updateSingleRecordWrapper(recordKey: string, value: ImmutableCast<T> | null): Promise<ImmutableRecordWrapper<T> | null> {
        const existingPendingRetrievalPromiseForRecord: Promise<ImmutableRecordWrapper<T> | null> | undefined = (
            this.pendingKeyItemsRetrievalPromises[recordKey]
        );
        if (existingPendingRetrievalPromiseForRecord !== undefined) {
            await existingPendingRetrievalPromiseForRecord;
        }
        const matchingRecordWrapper: ImmutableRecordWrapper<T> | undefined = this.RECORD_WRAPPERS[recordKey];
        if (value != null) {
            this.RECORD_WRAPPERS[recordKey] = ImmutableRecordWrapper.fromRecord<T>(this.props.itemModel, value);
        } else {
            delete this.RECORD_WRAPPERS[recordKey];
        }
        return matchingRecordWrapper !== undefined ? matchingRecordWrapper : null;
    }

    clearData() {
        this.RECORD_WRAPPERS = {};
        this.pendingKeyItemsRetrievalPromises = {};
    }
}