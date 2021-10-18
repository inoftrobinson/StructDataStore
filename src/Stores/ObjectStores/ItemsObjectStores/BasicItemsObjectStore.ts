import * as _ from 'lodash';
import * as immutable from 'immutable';
import ImmutableRecordWrapper from "../../../ImmutableRecordWrapper";
import BaseItemsObjectStore, {BaseItemsObjectStoreProps} from "./BaseItemsObjectStore";


export interface BasicItemsObjectStoreProps extends BaseItemsObjectStoreProps {
    retrieveAllItemsCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export default class BasicItemsObjectStore<T extends { [p: string]: any }> extends BaseItemsObjectStore<T> {
    public RECORD_WRAPPERS?: { [recordKey: string]: ImmutableRecordWrapper<T> | null } | undefined;
    private pendingRecordItemsRetrievalPromise?: Promise<any> | undefined;

    constructor(public readonly props: BasicItemsObjectStoreProps) {
        super(props);
        this.RECORD_WRAPPERS = undefined;
        this.pendingRecordItemsRetrievalPromise = undefined;
    }

    loadFromData(data: { [recordKey: string]: T }): { subscribersPromise: Promise<any> } {
        this.RECORD_WRAPPERS = this.recordsDataToWrappers(data);
        const subscribersPromise: Promise<any> = this.triggerSubscribers();
        return {subscribersPromise};
    }

    retrieveAndCacheAllRecordItems(): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }>  {
        if (this.pendingRecordItemsRetrievalPromise !== undefined) {
            return this.pendingRecordItemsRetrievalPromise;
        } else {
            const retrievalPromise: Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }> = (
                this.props.retrieveAllItemsCallable().then(responseData => {
                    if (responseData.success === true && responseData.data !== undefined) {
                        const recordWrappers: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = (
                            this.recordsDataToWrappers(responseData.data as { [recordKey: string]: T })
                        );
                        this.RECORD_WRAPPERS = recordWrappers;
                        this.triggerSubscribers();
                        // this.triggerSubscribersForKey(recordKey);
                        return recordWrappers;
                    }
                    this.props.onRetrievalFailure?.(responseData);
                    return {};
                })
            );
            this.pendingRecordItemsRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getRecordItems(): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }> {
        return this.RECORD_WRAPPERS !== undefined ? this.RECORD_WRAPPERS : this.retrieveAndCacheAllRecordItems();
    }

    async getSingleRecordItem(key: string): Promise<ImmutableRecordWrapper<T> | null> {
        const recordsItems: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = await this.getRecordItems();
        return recordsItems[key];
    }

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }> {
        const recordsWrappers: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = await this.getRecordItems();
        return _.transform(recordKeys, (output: { [recordKey: string]: ImmutableRecordWrapper<T> | null}, recordKey: string) => {
            output[recordKey] = recordsWrappers[recordKey];
        }, {});
    }
}