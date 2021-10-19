import * as _ from 'lodash';
import {RecordOf} from 'immutable';
import {BaseStore} from "../Stores/BaseStore";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../DataProcessors";
import {MapModel} from "../ModelsFields";
import {CreateUpdateRecordResponse} from "./ObjectStores/ObjectStores";
import RecordSubscriptionsWrapper from "../RecordSubscriptionsWrapper";
import RecordDataWrapper from "../RecordDataWrapper";


interface BaseFieldProps {
    itemModel: MapModel;
    retrieveDataCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export class TypedDictStore<T> extends BaseStore {
    private readonly RECORD_SUBSCRIPTIONS_WRAPPER: RecordSubscriptionsWrapper<T>;
    private CACHED_RECORD_DATA_WRAPPER?: RecordDataWrapper<T>;
    private pendingRetrievalPromise?: Promise<RecordOf<T> | null>;

    private readonly attrSubscribers: { [attrKey: string]: { [index: number] : () => any } };
    private readonly subscribersIndexesToSubscribedKeyPaths: { [subscriberIndex: number]: string[] };

    constructor(public readonly props: BaseFieldProps) {
        super();
        this.RECORD_SUBSCRIPTIONS_WRAPPER = new RecordSubscriptionsWrapper<T>(this);
        this.attrSubscribers = {};
        this.subscribersIndexesToSubscribedKeyPaths = {};
    }

    makeRecordDataWrapperFromData(recordData: T): RecordDataWrapper<T> | null {
        const recordItem: RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(recordData, this.props.itemModel) as RecordOf<T>;
        return recordItem != null ? new RecordDataWrapper(this.RECORD_SUBSCRIPTIONS_WRAPPER, recordItem, this.props.itemModel) : null;
    }

    subscribeToAttr(attrKeyPath: string, callback: () => any): number {
        return this.RECORD_SUBSCRIPTIONS_WRAPPER.subscribeToAttr(attrKeyPath, callback);
    }

    unsubscribe(subscriptionIndex: number): undefined {
        return this.RECORD_SUBSCRIPTIONS_WRAPPER.unsubscribe(subscriptionIndex);
    }

    triggerSubscribersForAttr(attrKey: string) {
        return this.RECORD_SUBSCRIPTIONS_WRAPPER.triggerSubscribersForAttr(attrKey);
    }

    retrieveAndCacheValue(): Promise<RecordOf<T> | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<RecordOf<T> | null> = this.props.retrieveDataCallable().then(responseData => {
                this.pendingRetrievalPromise = undefined;
                if (responseData.success === true) {
                    const recordDataWrapper: RecordDataWrapper<T> | null = this.makeRecordDataWrapperFromData(responseData.data as T);
                    this.CACHED_RECORD_DATA_WRAPPER = recordDataWrapper;
                    this.triggerSubscribers();
                    return recordDataWrapper.RECORD_DATA;
                } else {
                    this.props.onRetrievalFailure?.(responseData);
                    return null;
                }
            });
            this.pendingRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getValue(): Promise<RecordOf<T> | null> {
        return this.CACHED_RECORD_DATA_WRAPPER !== undefined ? this.CACHED_RECORD_DATA_WRAPPER.RECORD_DATA : this.retrieveAndCacheValue();
    }

    updateCachedRecord(record: RecordOf<T> | null): RecordOf<T> | undefined {
        const existingRecord: RecordOf<T> | undefined = this.CACHED_RECORD_DATA_WRAPPER?.RECORD_DATA;
        this.CACHED_RECORD_DATA_WRAPPER = this.makeRecordDataWrapperFromData(record);
        this.triggerSubscribers();
        return existingRecord;
    }

    createUpdateCachedRecordFromData(recordData: { [attrKey: string]: any }): CreateUpdateRecordResponse<T> {
        const recordItem: RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(recordData, this.props.itemModel) as RecordOf<T>;
        return recordItem != null ? {success: true, newRecord: recordItem, previousRecord: this.updateCachedRecord(recordItem)} : {success: false};
    }

    loadRecordFromJsonifiedData(jsonifiedRecordData: any): RecordOf<T> | null {
        try {
            const parsedRecordData: any = JSON.parse(jsonifiedRecordData);
            if (_.isPlainObject(parsedRecordData)) {
                const recordDataWrapper: RecordDataWrapper<T> | null = this.makeRecordDataWrapperFromData(parsedRecordData as T);
                this.CACHED_RECORD_DATA_WRAPPER = recordDataWrapper;
                this.triggerSubscribers();
                return recordDataWrapper.RECORD_DATA;
            }
        } catch (e) {
            console.log(`JSON Parsing error in loading the jsonified data : ${e}`);
        }
        return null;
    }
}
