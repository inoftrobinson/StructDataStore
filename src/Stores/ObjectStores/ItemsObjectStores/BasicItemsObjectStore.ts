import * as _ from 'lodash';
import * as immutable from 'immutable';
import SingleImmutableRecordWrapper from "../../../ImmutableRecordWrappers/SingleImmutableRecordWrapper";
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
    public RECORD_WRAPPERS?: { [recordKey: string]: SingleImmutableRecordWrapper<T> | null } | undefined;
    private pendingRecordItemsRetrievalPromise?: Promise<any> | undefined;

    constructor(public readonly props: BasicItemsObjectStoreProps<T>) {
        super(props);
        this.RECORD_WRAPPERS = undefined;
        this.pendingRecordItemsRetrievalPromise = undefined;
    }

    async updateItemWithSubscribersPromise(
        itemKey: string, itemData: immutable.RecordOf<T>
    ): Promise<{ oldValue: immutable.RecordOf<T> | null, subscribersPromise: Promise<any> }> {
        // Item update without having previously loaded the said item is not allowed
        await this.getRecordItems();
        if (this.RECORD_WRAPPERS !== undefined) {
            const existingRecordWrapper: SingleImmutableRecordWrapper<T> | null = this.RECORD_WRAPPERS[itemKey];
            this.RECORD_WRAPPERS[itemKey] = new SingleImmutableRecordWrapper<T>(itemData, this.props.itemModel);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(itemKey);
            return {oldValue: existingRecordWrapper != null ? existingRecordWrapper.RECORD_DATA : null, subscribersPromise};
        } else {
            return {oldValue: null, subscribersPromise: Promise.resolve(undefined)};
        }
    }

    loadFromData(data: { [recordKey: string]: T }): { subscribersPromise: Promise<any> } {
        this.RECORD_WRAPPERS = this.recordsDataToWrappers(data);
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        return {subscribersPromise};
    }

    retrieveAndCacheAllRecordItems(): Promise<{ [recordKey: string]: SingleImmutableRecordWrapper<T> | null }>  {
        if (this.pendingRecordItemsRetrievalPromise !== undefined) {
            return this.pendingRecordItemsRetrievalPromise;
        } else {
            const retrievalPromise: Promise<{ [recordKey: string]: SingleImmutableRecordWrapper<T> | null }> = (
                this.props.retrieveAllItemsCallable().then((result: RetrieveAllItemsCallablePromiseResult<T>) => {
                    const {success, data, metadata}: RetrieveAllItemsCallablePromiseResult<T> = result;
                    if (success && data != null) {
                        const recordWrappers: { [recordKey: string]: SingleImmutableRecordWrapper<T> | null } = this.recordsDataToWrappers(data);
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

    async getRecordItems(): Promise<{ [recordKey: string]: SingleImmutableRecordWrapper<T> | null }> {
        return this.RECORD_WRAPPERS !== undefined ? this.RECORD_WRAPPERS : this.retrieveAndCacheAllRecordItems();
    }

    async getSingleRecordItem(key: string): Promise<SingleImmutableRecordWrapper<T> | null> {
        const recordsItems: { [recordKey: string]: SingleImmutableRecordWrapper<T> | null } = await this.getRecordItems();
        return recordsItems[key];
    }

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [recordKey: string]: SingleImmutableRecordWrapper<T> | null }> {
        const recordsWrappers: { [recordKey: string]: SingleImmutableRecordWrapper<T> | null } = await this.getRecordItems();
        return _.transform(recordKeys, (output: { [recordKey: string]: SingleImmutableRecordWrapper<T> | null}, recordKey: string) => {
            output[recordKey] = recordsWrappers[recordKey];
        }, {});
    }
}