import * as _ from 'lodash';
import * as immutable from 'immutable';
import ImmutableRecordWrapper from "../../../ImmutableRecordWrapper";
import {BaseItemsObjectStore, BaseItemsObjectStoreProps} from "./BaseItemsObjectStore";


export type RetrieveAllItemsCallablePromiseResult<T> = {
    success: boolean;
    data: { [itemKey: string]: T } | null;
    metadata?: { [metadataKey: string]: any }
};
export interface BasicItemsObjectStoreProps<T> extends BaseItemsObjectStoreProps {
    retrieveAllItemsCallable: () => Promise<RetrieveAllItemsCallablePromiseResult<T>>;
    onRetrievalFailure?: (metadata?: { [metadataKey: string]: any }) => any;
}

export class BasicItemsObjectStore<T extends { [p: string]: any }> extends BaseItemsObjectStore<T> {
    public RECORD_WRAPPERS?: { [recordKey: string]: ImmutableRecordWrapper<T> | null } | undefined;
    private pendingRecordItemsRetrievalPromise?: Promise<any> | undefined;

    constructor(public readonly props: BasicItemsObjectStoreProps<T>) {
        super(props);
        this.RECORD_WRAPPERS = undefined;
        this.pendingRecordItemsRetrievalPromise = undefined;
    }

    loadFromDataWithReturnedSubscribersPromise(data: { [recordKey: string]: T }): { success: boolean; subscribersPromise: Promise<any> } {
        this.RECORD_WRAPPERS = this.recordsDataToWrappers(data);
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        return {success: true, subscribersPromise};
    }

    retrieveAndCacheAllRecords(): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }>  {
        if (this.pendingRecordItemsRetrievalPromise !== undefined) {
            return this.pendingRecordItemsRetrievalPromise;
        } else {
            const retrievalPromise: Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }> = (
                this.props.retrieveAllItemsCallable().then((result: RetrieveAllItemsCallablePromiseResult<T>) => {
                    const {success, data, metadata}: RetrieveAllItemsCallablePromiseResult<T> = result;
                    if (success && data != null) {
                        const recordWrappers: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = this.recordsDataToWrappers(data);
                        this.RECORD_WRAPPERS = recordWrappers;
                        this.triggerSubscribers();
                        // this.triggerSubscribersForKey(recordKey);
                        return recordWrappers;
                    }
                    this.props.onRetrievalFailure?.(metadata);
                    return {};
                })
            );
            this.pendingRecordItemsRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getRecords(): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }> {
        return this.RECORD_WRAPPERS !== undefined ? this.RECORD_WRAPPERS : this.retrieveAndCacheAllRecords();
    }

    async getSingleRecord(key: string): Promise<ImmutableRecordWrapper<T> | null> {
        const recordsItems: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = await this.getRecords();
        return recordsItems[key];
    }

    async getMultipleRecords(recordKeys: string[]): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }> {
        const recordsWrappers: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = await this.getRecords();
        return _.transform(recordKeys, (output: { [recordKey: string]: ImmutableRecordWrapper<T> | null}, recordKey: string) => {
            output[recordKey] = recordsWrappers[recordKey];
        }, {});
    }

    clearData() {
        this.RECORD_WRAPPERS = undefined;
        this.pendingRecordItemsRetrievalPromise = undefined;
    }
}