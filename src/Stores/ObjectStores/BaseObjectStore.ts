import * as _ from 'lodash';
import * as immutable from 'immutable';
import {MapModel} from "../../ModelsFields";
import BaseStore from "../BaseStore";
import RecordSubscriptionsWrapper from "../../RecordSubscriptionsWrapper";
import RecordDataWrapper from "../../RecordDataWrapper";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../DataProcessors";
import {CreateUpdateRecordResponse} from "../../models";


export interface BaseObjectProps {

}

export default abstract class BaseObjectStore<T extends { [attrKeyPath: string]: any }> extends BaseStore {
    private readonly RECORDS_SUBSCRIPTIONS_WRAPPERS: { [recordKey: string]: RecordSubscriptionsWrapper<T> };
    public CACHED_RECORDS_DATA_WRAPPERS?: { [recordKey: string]: RecordDataWrapper<T> };
    public activeSubscribersIndex: number;
    // private readonly keysSubscribers: { [recordKey: string]: { [index: number] : () => any } };
    private readonly subscribersIndexesToRecordKeys: { [subscriberIndex: number]: string };

    protected constructor(public readonly props: BaseObjectProps) {
        super();
        this.RECORDS_SUBSCRIPTIONS_WRAPPERS = {};
        this.activeSubscribersIndex = 0;
        // this.keysSubscribers = {};
        this.subscribersIndexesToRecordKeys = {};
    }

    private makeGetRecordSubscriptionsWrapper(recordKey: string): RecordSubscriptionsWrapper<T> {
        const existingRecordSubscriptionsWrapper: RecordSubscriptionsWrapper<T> | undefined = this.RECORDS_SUBSCRIPTIONS_WRAPPERS[recordKey];
        if (existingRecordSubscriptionsWrapper !== undefined) {
            return existingRecordSubscriptionsWrapper;
        } else {
            const newRecordSubscriptionsWrapper: RecordSubscriptionsWrapper<T> = new RecordSubscriptionsWrapper<T>(this);
            this.RECORDS_SUBSCRIPTIONS_WRAPPERS[recordKey] = newRecordSubscriptionsWrapper;
            return newRecordSubscriptionsWrapper;
        }
    }

    makeRecordDataWrapperFromItem(recordKey: string, recordItem: immutable.RecordOf<T>): RecordDataWrapper<T> {
        const matchingRecordSubscriptions: RecordSubscriptionsWrapper<T> = this.makeGetRecordSubscriptionsWrapper(recordKey);
        return new RecordDataWrapper(matchingRecordSubscriptions, recordItem, this.props.itemModel);
    }

    makeRecordDataWrapperFromData(recordKey: string, recordData: T): RecordDataWrapper<T> | null {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(recordData, this.props.itemModel) as immutable.RecordOf<T>;
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordKey, recordItem) : null;
    }

    protected internalCreateUpdateRecordItem(recordKey: string, recordItem: immutable.RecordOf<T>): immutable.RecordOf<T> | undefined {
        const existingRecordDataWrapper: RecordDataWrapper<T> | undefined = this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey];
        if (this.CACHED_RECORDS_DATA_WRAPPERS === undefined) {
            this.CACHED_RECORDS_DATA_WRAPPERS = {};
        }
        this.CACHED_RECORDS_DATA_WRAPPERS[recordKey] = this.makeRecordDataWrapperFromItem(recordKey, recordItem);
        return existingRecordDataWrapper?.RECORD_DATA;
    }

    protected internalRemoveCachedRecord(recordKey: string): immutable.RecordOf<T> | undefined {
        const existingRecordDataWrapper: RecordDataWrapper<T> | undefined = this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey];
        if (this.CACHED_RECORDS_DATA_WRAPPERS !== undefined) {
            delete this.CACHED_RECORDS_DATA_WRAPPERS[recordKey];
        }
        return existingRecordDataWrapper?.RECORD_DATA;
    }

    subscribeToRecord(recordKey: string, callback: () => any): number {
        const subscriptionIndex: number = this.makeGetRecordSubscriptionsWrapper(recordKey).subscribeObjectWide(callback);
        this.subscribersIndexesToRecordKeys[subscriptionIndex] = recordKey;
        return subscriptionIndex;
    }

    unsubscribe(subscriptionIndex: number): undefined {
        const matchingRecordKey: string | undefined = this.subscribersIndexesToRecordKeys[subscriptionIndex];
        if (matchingRecordKey !== undefined) {
            const matchingRecordSubscriptionsWrapper: RecordSubscriptionsWrapper<T> | undefined = this.RECORDS_SUBSCRIPTIONS_WRAPPERS[matchingRecordKey];
            if (matchingRecordSubscriptionsWrapper !== undefined) {
                matchingRecordSubscriptionsWrapper.unsubscribe(subscriptionIndex);
            }
            delete this.subscribersIndexesToRecordKeys[subscriptionIndex];
        }
        return undefined;
    }

    async triggerSubscribersForKey(recordKey: string): Promise<void> {
        const matchingRecordSubscriptionsWrapper: RecordSubscriptionsWrapper<T> = this.makeGetRecordSubscriptionsWrapper(recordKey);
        // Instead of only triggering the subscribers if the RecordSubscriptionsWrapper exist, we use the makeGetRecordSubscriptionsWrapper
        // to create a new one if it is missing, because the call to triggerObjectWideSubscribers will also call the triggerListeners of the
        // parent field (ie, out current ObjectStore instance) which we want to call even if the record key did not had a subscriptionsWrapper.
        await matchingRecordSubscriptionsWrapper.triggerObjectWideSubscribers();
    }

    async triggerAllRecordsSubscribers(): Promise<void> {
        await Promise.all(_.map(this.RECORDS_SUBSCRIPTIONS_WRAPPERS, async (recordSubscriptionWrapper: RecordSubscriptionsWrapper<T>) => {
            await recordSubscriptionWrapper.triggerAllSubscribers();
        }));
    }

    updateCachedRecord(key: string, record: immutable.RecordOf<T> | null): { oldRecord: immutable.RecordOf<T> | undefined, subscribersPromise: Promise<any> } {
        const oldRecord: immutable.RecordOf<T> | undefined = (
            record != null ? this.internalCreateUpdateRecordItem(key, record) : this.internalRemoveCachedRecord(key)
        );
        const subscribersPromise: Promise<any> = this.triggerSubscribersForKey(key);
        return {oldRecord, subscribersPromise};
    }

    // todo: implement two function (one with returned subscribers promise and the other not) for all operations
    updateCachedRecordAttr(recordKey: string, attrKeyPath: string, value: any): any | undefined {
        return this.updateCachedRecordAttrWithReturnedSubscribersPromise(recordKey, attrKeyPath, value).oldValue;
    }

    updateCachedRecordAttrWithReturnedSubscribersPromise(recordKey: string, attrKeyPath: string, value: any): (
        { oldValue: any | undefined, subscribersPromise: Promise<any> }
    ) {
        return this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey]?.updateAttr(attrKeyPath, value);
    }

    updateCachedRecordMultipleAttrs(recordKey: string, mutators: Partial<T>): IterableIterator<[keyof T, T[keyof T]]> | undefined {
        return this.updateCachedRecordMultipleAttrsWithReturnedSubscribersPromise(recordKey, mutators).oldValues;
    }

    updateCachedRecordMultipleAttrsWithReturnedSubscribersPromise(recordKey: string, mutators: Partial<T>): {
        oldValues: IterableIterator<[keyof T, T[keyof T]]> | undefined, subscribersPromise: Promise<any>
    } {
        const response = this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey]?.updateMultipleAttrs(mutators);
        return response !== undefined ? response : {oldValues: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    deleteCachedRecordAttr(recordKey: string, attrKeyPath: string): { subscribersPromise: Promise<any> } {
        const response = this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey]?.deleteAttr(attrKeyPath);
        return response !== undefined ? response : {subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    removeCachedRecordAttr(recordKey: string, attrKeyPath: string): { oldValue: any | undefined, subscribersPromise: Promise<any> } {
        const response = this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey]?.removeAttr(attrKeyPath);
        return response !== undefined ? response : {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    subscribeToRecordAttr(recordKey: string, attrKeyPath: string, callback: () => any): number {
        const subscriptionIndex: number = this.makeGetRecordSubscriptionsWrapper(recordKey).subscribeToAttr(attrKeyPath, callback);
        this.subscribersIndexesToRecordKeys[recordKey] = subscriptionIndex;
        return subscriptionIndex;
    }

    subscribeToRecordMultipleAttrs(recordKey: string, attrsKeyPaths: string[], callback: () => any): number {
        const subscriptionIndex: number = this.makeGetRecordSubscriptionsWrapper(recordKey).subscribeToMultipleAttrs(attrsKeyPaths, callback);
        this.subscribersIndexesToRecordKeys[subscriptionIndex] = recordKey;
        return subscriptionIndex;
    }

    createUpdateCachedRecordFromData(key: string, recordData: { [attrKey: string]: any }): CreateUpdateRecordResponse<T> {
        const recordDataWrapper: RecordDataWrapper<T> | null = this.makeRecordDataWrapperFromData(key, recordData as T);
        if (recordDataWrapper != null) {
            const {oldRecord, subscribersPromise} = this.updateCachedRecord(key, recordDataWrapper.RECORD_DATA);
            return {success: true, newRecord: recordDataWrapper.RECORD_DATA, previousRecord: oldRecord, subscribersPromise};
        }
        return {success: false, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    updateCachedRecords(records: { [key: string]: immutable.RecordOf<T> | null }): {
        oldRecords: { [key: string]: immutable.RecordOf<T> | undefined }, subscribersPromise: Promise<any>
    } {
        if (Object.keys(records).length > 0) {
            const existingRecords: { [key: string]: immutable.RecordOf<T> | undefined } = _.transform(
                records,
                (result: { [key: string]: immutable.RecordOf<T> | undefined }, recordItem: immutable.RecordOf<T> | null, key: string) => {
                    result[key] = (recordItem != null ?
                        this.internalCreateUpdateRecordItem(key, recordItem) :
                        this.internalRemoveCachedRecord(key)
                    );
                    // The internalCreateUpdateRecordItem does not call the triggerSubscribers
                    // function, which allows us to call it only after we updated all the records.
                },
                {}
            );
            const promises: Promise<any>[] = [];
            for (let recordKey in existingRecords) {
                promises.push(this.triggerSubscribersForKey(recordKey));
            }
            promises.push(this.triggerSubscribers());
            const subscribersPromise: Promise<any> = Promise.all(promises);
            return {oldRecords: existingRecords, subscribersPromise};
        }
        return {oldRecords: {}, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    createUpdateCachedRecordsFromData(recordsData: { [recordKey: string]: { [attrKey: string]: any } }): {
        responses: { [recordKey: string]: CreateUpdateRecordResponse<T> }, subscribersPromise: Promise<any>
    } {
        const recordsToUpdates: { [recordKey: string]: immutable.RecordOf<T> } = {};
        const responses: { [recordKey: string]: CreateUpdateRecordResponse<T> } = _.transform(
            recordsData, (result: { [key: string]: any }, recordDataItem: { [attrKey: string]: any }, recordKey: string) => {
                const recordDataWrapper: RecordDataWrapper<T> | null = this.makeRecordDataWrapperFromData(recordKey, recordDataItem as T);
                if (recordDataWrapper != null) {
                    recordsToUpdates[recordKey] = recordDataWrapper.RECORD_DATA;
                    result[recordKey] = {success: true, newRecord: recordDataWrapper.RECORD_DATA, previousRecord: undefined};
                } else {
                    result[recordKey] = {success: false};
                }
            }
        );
        const {oldRecords, subscribersPromise} = this.updateCachedRecords(recordsToUpdates);
        _.forEach(oldRecords, (previousRecordItem: immutable.RecordOf<T> | undefined, recordKey: string) => {
            responses[recordKey].previousRecord = previousRecordItem;
        });
        return {responses, subscribersPromise};
    }

    removeCachedRecord(key: string): { oldRecord: immutable.RecordOf<T> | undefined, subscribersPromise: Promise<any> } {
        const existingRecordItem: immutable.RecordOf<T> | undefined = this.internalRemoveCachedRecord(key);
        const subscribersPromise: Promise<any> = Promise.all([
            this.triggerSubscribersForKey(key),
            this.triggerSubscribers()
        ]);
        return {oldRecord: existingRecordItem, subscribersPromise};
    }

    removeCachedRecords(keys: string[]): {
        oldRecords: { [key: string]: immutable.RecordOf<T> | undefined }, subscribersPromise: Promise<any>
    } {
        const existingRecords: { [key: string]: immutable.RecordOf<T> } = _.transform(
            keys,
            (result: { [key: string]: immutable.RecordOf<T> | undefined }, key: string) => {
                result[key] = this.internalRemoveCachedRecord(key);
                // The internalRemoveCachedRecord does not call the triggerSubscribers
                // function, which allows us to call it only after we removed all the records.
            },
            {} // Specifying an object has the accumulator is crucial here, because since keys is an array, if we do not
               // specify the accumulator, lodash will by default create an array accumulator, which is not what we want.
        );
        const promises: Promise<any>[] = [];
        _.forEach(existingRecords, ((__: any, recordKey: string) => {
            promises.push(this.triggerSubscribersForKey(recordKey));
        }));
        promises.push(this.triggerSubscribers());
        const subscribersPromise: Promise<any> = Promise.all(promises);
        return {oldRecords: existingRecords, subscribersPromise};
    }

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

    loadRecordsFromJsonifiedData(jsonifiedRecordsData: any): {
        records: { [key: string]: immutable.RecordOf<T> | undefined }, subscribersPromise: Promise<any>
    } | null {
        try {
            const parsedRecordsData: any = JSON.parse(jsonifiedRecordsData);
            if (_.isPlainObject(parsedRecordsData)) {
                return this.loadRecordsFromData(parsedRecordsData);
            } else {
                console.warn(`Parsed records data was not a plain object and could not be loaded`);
            }
        } catch (e) {
            console.warn(`JSON Parsing error in loading the jsonified data : ${e}`);
        }
        return null;
    }
}