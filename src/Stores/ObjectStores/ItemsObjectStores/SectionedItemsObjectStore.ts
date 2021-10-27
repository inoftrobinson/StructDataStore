import * as _ from 'lodash';
import * as immutable from 'immutable';
import SingleImmutableRecordWrapper from "../../../ImmutableRecordWrappers/SingleImmutableRecordWrapper";
import {BaseItemsObjectStore, BaseItemsObjectStoreProps} from "./BaseItemsObjectStore";
import {BaseDataRetrievalPromiseResult} from "../../../models";


export type RetrieveSingleItemCallablePromiseResult<T> = BaseDataRetrievalPromiseResult<T>;
export type RetrieveMultipleItemsCallablePromiseResult<T> = BaseDataRetrievalPromiseResult<{ [itemKey: string]: T }>;

export interface SectionedItemsObjectStoreProps<T> extends BaseItemsObjectStoreProps {
    retrieveSingleItemCallable?: (key: string) => Promise<RetrieveSingleItemCallablePromiseResult<T>>;
    retrieveMultipleItemsCallable?: (keys: string[]) => Promise<RetrieveMultipleItemsCallablePromiseResult<T>>;
    onItemRetrievalFailure?: (metadata?: { [metadataKey: string]: any }) => any;
}

export class SectionedItemsObjectStore<T extends { [p: string]: any }> extends BaseItemsObjectStore<T> {
    public RECORD_WRAPPERS: { [key: string]: SingleImmutableRecordWrapper<T> };
    private readonly pendingKeyItemsRetrievalPromises: { [key: string]: Promise<SingleImmutableRecordWrapper<T> | null> };

    constructor(public readonly props: SectionedItemsObjectStoreProps<T>) {
        super(props);
        this.RECORD_WRAPPERS = {};
        this.pendingKeyItemsRetrievalPromises = {};
    }

    loadFromData(data: { [recordKey: string]: T }): { subscribersPromise: Promise<any> } {
        this.RECORD_WRAPPERS = this.recordsDataToWrappers(data);
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        return {subscribersPromise};
    }

    retrieveAndCacheRecordItem(recordKey: string): Promise<SingleImmutableRecordWrapper<T> | null>  {
        const existingPendingPromise: Promise<SingleImmutableRecordWrapper<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[recordKey];
        if (existingPendingPromise !== undefined) {
            return existingPendingPromise;
        } else {
            if (this.props.retrieveSingleItemCallable !== undefined) {
                const retrievalPromise: Promise<SingleImmutableRecordWrapper<T> | null> = (
                    this.props.retrieveSingleItemCallable(recordKey).then((result: RetrieveSingleItemCallablePromiseResult<T>) => {
                        const {success, data, metadata}: RetrieveSingleItemCallablePromiseResult<T> = result;
                        delete this.pendingKeyItemsRetrievalPromises[recordKey];
                        if (success && data != null) {
                            const recordWrapper: SingleImmutableRecordWrapper<T> | null = this.makeRecordWrapperFromData(recordKey, data);
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
            return new Promise<SingleImmutableRecordWrapper<T> | null>(resolve => resolve(null));
        }
    }

    async getSingleRecordItem(key: string): Promise<SingleImmutableRecordWrapper<T> | null> {
        return this.RECORD_WRAPPERS[key] !== undefined ? this.RECORD_WRAPPERS[key] : this.retrieveAndCacheRecordItem(key);
    }

    async retrieveAndCacheMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: SingleImmutableRecordWrapper<T> | null }>  {
        const keysRequiringRetrieval: string[] = [];
        const keysPromises: Promise<{ key: string, record: SingleImmutableRecordWrapper<T> | null }>[] = [];
        recordKeys.forEach((key: string) => {
            const existingKeyPendingPromise: Promise<SingleImmutableRecordWrapper<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[key];
            if (existingKeyPendingPromise !== undefined) {
                keysPromises.push(existingKeyPendingPromise.then((record: SingleImmutableRecordWrapper<T> | null) => ({key, record})));
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            if (this.props.retrieveMultipleItemsCallable !== undefined) {
                const baseMultiItemsRetrievalPromise = this.props.retrieveMultipleItemsCallable(keysRequiringRetrieval);
                keysRequiringRetrieval.forEach((recordKey: string) => {
                    const keyItemRetrievalPromise: Promise<SingleImmutableRecordWrapper<T> | null> = (
                        baseMultiItemsRetrievalPromise.then((result: RetrieveMultipleItemsCallablePromiseResult<T>) => {
                            const {success, data, metadata}: RetrieveMultipleItemsCallablePromiseResult<T> = result;
                            delete this.pendingKeyItemsRetrievalPromises[recordKey];
                            if (success && data != null) {
                                const itemsDataContainer: { [itemKey: string]: { [attrKey: string]: any } } = data;
                                const itemData: { [attrKey: string]: any } | undefined = itemsDataContainer[recordKey];
                                if (itemData !== undefined) {
                                    const recordWrapper: SingleImmutableRecordWrapper<T> | null = (
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
                    keysPromises.push(keyItemRetrievalPromise.then((record: SingleImmutableRecordWrapper<T> | null) => ({key: recordKey, record})));
                });
            } else if (this.props.retrieveSingleItemCallable !== undefined) {
                // todo: if retrieveMultipleItemsCallable is not defined, use the retrieveItemCallable
                //  callable multiple times asynchronously to retrieve the multiple records
            } else {
                console.error('retrieveMultipleItemsCallable or retrieveItemCallable must be defined');
            }
        }
        const keysContainers: { key: string, record: SingleImmutableRecordWrapper<T> | null }[] = await Promise.all(keysPromises);
        this.triggerSubscribers();
        return _.transform(keysContainers, (result: { [key: string]: any }, container: { key: string, record: SingleImmutableRecordWrapper<T> | null }) => {
            result[container.key] = container.record;
        }, {});
    }

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: SingleImmutableRecordWrapper<T> | null }> {
        const keysRequiringRetrieval: string[] = [];
        const existingItemsDataWrappers: { [key: string]: SingleImmutableRecordWrapper<T> } = {};
        recordKeys.forEach((key: string) => {
            const existingRecordDataWrapper: SingleImmutableRecordWrapper<T> | undefined = this.RECORD_WRAPPERS[key];
            if (existingRecordDataWrapper !== undefined) {
                existingItemsDataWrappers[key] = existingRecordDataWrapper;
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            const retrievedRecordsItems: { [key: string]: SingleImmutableRecordWrapper<T> | null} = (
                await this.retrieveAndCacheMultipleRecordItems(keysRequiringRetrieval)
            );
            return {...existingItemsDataWrappers, ...retrievedRecordsItems};
        } else {
            return existingItemsDataWrappers;
        }
    }
}