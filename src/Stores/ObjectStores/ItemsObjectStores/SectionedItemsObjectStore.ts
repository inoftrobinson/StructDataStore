import * as _ from 'lodash';
import * as immutable from 'immutable';
import ImmutableRecordWrapper from "../../../ImmutableRecordWrapper";
import {BaseItemsObjectStore, BaseItemsObjectStoreProps} from "./BaseItemsObjectStore";


export type RetrieveSingleItemCallablePromiseResult<T> = {
    success: boolean;
    data: T | null;
    metadata?: { [metadataKey: string]: any }
};
export type RetrieveMultipleItemsCallablePromiseResult<T> = {
    success: boolean;
    data: { [itemKey: string]: T } | null;
    metadata?: { [metadataKey: string]: any }
};
export interface SectionedItemsObjectStoreProps<T> extends BaseItemsObjectStoreProps {
    retrieveSingleItemCallable?: (key: string) => Promise<RetrieveSingleItemCallablePromiseResult<T>>;
    retrieveMultipleItemsCallable?: (keys: string[]) => Promise<RetrieveMultipleItemsCallablePromiseResult<T>>;
    onItemRetrievalFailure?: (metadata?: { [metadataKey: string]: any }) => any;
}

export class SectionedItemsObjectStore<T extends { [p: string]: any }> extends BaseItemsObjectStore<T> {
    public RECORD_WRAPPERS: { [key: string]: ImmutableRecordWrapper<T> };
    private readonly pendingKeyItemsRetrievalPromises: { [key: string]: Promise<ImmutableRecordWrapper<T> | null> };

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

    updateItemWithSubscribersPromise(
        itemKey: string, itemData: immutable.RecordOf<T>
    ): Promise<{ oldValue: immutable.RecordOf<T> | null, subscribersPromise: Promise<any> }> {
        // Item update without having previously loaded the said item is allowed
        const oldValue: immutable.RecordOf<T> | null = this.RECORD_WRAPPERS[itemKey]?.RECORD_DATA;
        this.RECORD_WRAPPERS[itemKey] = new ImmutableRecordWrapper<T>(itemData, this.props.itemModel);
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(itemKey);
        return {oldValue, subscribersPromise};
    }

    retrieveAndCacheRecordItem(recordKey: string): Promise<ImmutableRecordWrapper<T> | null>  {
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

    async getSingleRecordItem(key: string): Promise<ImmutableRecordWrapper<T> | null> {
        return this.RECORD_WRAPPERS[key] !== undefined ? this.RECORD_WRAPPERS[key] : this.retrieveAndCacheRecordItem(key);
    }

    async retrieveAndCacheMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: ImmutableRecordWrapper<T> | null }>  {
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
                                        this.triggerSubscribersForAttr(recordKey);
                                        return recordWrapper;
                                    }
                                }
                            }
                            this.props.onItemRetrievalFailure?.(metadata);
                            // this.triggerSubscribersForKey(recordKey);
                            this.triggerSubscribersForAttr(recordKey);
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

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: ImmutableRecordWrapper<T> | null }> {
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
                await this.retrieveAndCacheMultipleRecordItems(keysRequiringRetrieval)
            );
            return {...existingItemsDataWrappers, ...retrievedRecordsItems};
        } else {
            return existingItemsDataWrappers;
        }
    }
}