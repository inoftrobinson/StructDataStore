import * as _ from 'lodash';
import { RecordOf } from "immutable";
import BaseField from "./BaseField";
import {MapModel} from "./ModelsFields";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "./DataProcessors";
import ContainerField from "./ContainerField";
import RecordSubscriptionsWrapper from "./RecordSubscriptionsWrapper";
import RecordDataWrapper from "./RecordDataWrapper";
import {CachedSceneNodeDataRecord} from "../../applications/editor/_diagrams/models";
import DiagramsDataStore from "../../applications/editor/_diagrams/DiagramsDataStore";


export interface CreateUpdateRecordResponse<T> {
    success: boolean;
    newRecord?: RecordOf<T>;
    previousRecord?: RecordOf<T>;
}


interface BaseFieldProps {
    itemModel: MapModel;
}

abstract class BaseObjectField<T extends { [attrKeyPath: string]: any }> extends BaseField {
    private readonly RECORDS_SUBSCRIPTIONS_WRAPPERS: { [recordKey: string]: RecordSubscriptionsWrapper<T> };
    public CACHED_RECORDS_DATA_WRAPPERS?: { [recordKey: string]: RecordDataWrapper<T> };
    public activeSubscribersIndex: number;
    // private readonly keysSubscribers: { [recordKey: string]: { [index: number] : () => any } };
    private readonly subscribersIndexesToRecordKeys: { [subscriberIndex: number]: string };

    protected constructor(public readonly props: BaseFieldProps) {
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

    makeRecordDataWrapperFromItem(recordKey: string, recordItem: RecordOf<T>): RecordDataWrapper<T> {
        const matchingRecordSubscriptions: RecordSubscriptionsWrapper<T> = this.makeGetRecordSubscriptionsWrapper(recordKey);
        return new RecordDataWrapper(matchingRecordSubscriptions, recordItem);
    }

    makeRecordDataWrapperFromData(recordKey: string, recordData: T): RecordDataWrapper<T> | null {
        const recordItem: RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(recordData, this.props.itemModel) as RecordOf<T>;
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordKey, recordItem) : null;
    }

    protected internalCreateUpdateRecordItem(recordKey: string, recordItem: RecordOf<T>): RecordOf<T> | undefined {
        const existingRecordSubscriptionsWrapper: RecordSubscriptionsWrapper<T> | undefined = this.RECORDS_SUBSCRIPTIONS_WRAPPERS[recordKey];
        const existingRecordDataWrapper: RecordDataWrapper<T> | undefined = this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey];

        if (this.CACHED_RECORDS_DATA_WRAPPERS === undefined) {
            this.CACHED_RECORDS_DATA_WRAPPERS = {};
        }
        this.CACHED_RECORDS_DATA_WRAPPERS[recordKey] = this.makeRecordDataWrapperFromItem(recordKey, recordItem);

        existingRecordSubscriptionsWrapper?.triggerAllSubscribers();
        return existingRecordDataWrapper?.RECORD_DATA;
    }

    protected internalRemoveCachedRecord(recordKey: string): RecordOf<T> | undefined {
        const existingRecordSubscriptionsWrapper: RecordSubscriptionsWrapper<T> | undefined = this.RECORDS_SUBSCRIPTIONS_WRAPPERS[recordKey];
        const existingRecordDataWrapper: RecordDataWrapper<T> | undefined = this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey];

        if (this.CACHED_RECORDS_DATA_WRAPPERS !== undefined) {
            delete this.CACHED_RECORDS_DATA_WRAPPERS[recordKey];
        }
        existingRecordSubscriptionsWrapper?.triggerAllSubscribers();
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

    triggerSubscribersForKey(recordKey: string) {
        const matchingRecordSubscriptionsWrapper: RecordSubscriptionsWrapper<T> | undefined = this.RECORDS_SUBSCRIPTIONS_WRAPPERS[recordKey];
        if (matchingRecordSubscriptionsWrapper !== undefined) {
            matchingRecordSubscriptionsWrapper.triggerObjectWideSubscribers();
        }
    }

    triggerAllRecordsSubscribers() {
        _.forEach(this.RECORDS_SUBSCRIPTIONS_WRAPPERS, (recordSubscriptionWrapper: RecordSubscriptionsWrapper<T>) => {
            recordSubscriptionWrapper.triggerAllSubscribers();
        })
    }

    updateCachedRecord(key: string, record: RecordOf<T> | null): RecordOf<T> | undefined {
        const existingRecordItem: RecordOf<T> | undefined = (
            record != null ? this.internalCreateUpdateRecordItem(key, record) : this.internalRemoveCachedRecord(key)
        );
        this.triggerSubscribersForKey(key);
        this.triggerSubscribers();
        return existingRecordItem;
    }

    updateCachedRecordAttr(recordKey: string, attrKeyPath: string, value: any): any | undefined {
        return this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey]?.updateAttr(attrKeyPath, value);
    }

    updateCachedRecordMultipleAttrs(recordKey: string, mutators: Partial<T>): IterableIterator<[keyof T, T[keyof T]]> | undefined {
        return this.CACHED_RECORDS_DATA_WRAPPERS?.[recordKey]?.updateMultipleAttrs(mutators);
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
        return recordDataWrapper != null ? {success: true, newRecord: recordDataWrapper.RECORD_DATA, previousRecord: this.updateCachedRecord(key, recordDataWrapper.RECORD_DATA)} : {success: false};
    }

    updateCachedRecords(records: { [key: string]: RecordOf<T> | null }): { [key: string]: RecordOf<T> | undefined } {
        if (Object.keys(records).length > 0) {
            const existingRecords: { [key: string]: RecordOf<T> | undefined } = _.transform(
                records,
                (result: { [key: string]: RecordOf<T> | undefined }, recordItem: RecordOf<T> | null, key: string) => {
                    result[key] = recordItem != null ? this.internalCreateUpdateRecordItem(key, recordItem) : this.internalRemoveCachedRecord(key);
                    // The internalCreateUpdateRecordItem does not call the triggerSubscribers
                    // function, which allows us to call it only after we updated all the records.
                },
                {}
            );
            for (let recordKey in existingRecords) {
                this.triggerSubscribersForKey(recordKey);
            }
            this.triggerSubscribers();
            return existingRecords;
        }
        return {};
    }

    createUpdateCachedRecordsFromData(recordsData: { [recordKey: string]: { [attrKey: string]: any } }): { [recordKey: string]: CreateUpdateRecordResponse<T> } {
        const recordsToUpdates: { [recordKey: string]: RecordOf<T> } = {};
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
        _.forEach(this.updateCachedRecords(recordsToUpdates), (previousRecordItem: RecordOf<T> | undefined, recordKey: string) => {
            responses[recordKey].previousRecord = previousRecordItem;
        });
        return responses;
    }

    removeCachedRecord(key: string): RecordOf<T> | undefined {
        const existingRecordItem: RecordOf<T> | undefined = this.internalRemoveCachedRecord(key);
        this.triggerSubscribersForKey(key);
        this.triggerSubscribers();
        return existingRecordItem;
    }

    removeCachedRecords(keys: string[]): { [key: string]: RecordOf<T> | undefined } {
        const existingRecords: { [key: string]: RecordOf<T> } = _.transform(
            keys,
            (result: { [key: string]: RecordOf<T> | undefined }, key: string) => {
                result[key] = this.internalRemoveCachedRecord(key);
                // The internalRemoveCachedRecord does not call the triggerSubscribers
                // function, which allows us to call it only after we removed all the records.
            },
            {} // Specifying an object has the accumulator is crucial here, because since keys is an array, if we do not
               // specify the accumulator, lodash will by default create an array accumulator, which is not what we want.
        );
        _.forEach(existingRecords, ((__: any, recordKey: string) => {
            this.triggerSubscribersForKey(recordKey);
        }));
        this.triggerSubscribers();
        return existingRecords;
    }


    loadRecordsFromData(recordsData: { [recordId: string]: T }) {
        const recordsDataWrappers: { [key: string]: RecordDataWrapper<T> } = _.transform(
            recordsData,
            (result: { [key: string]: RecordDataWrapper<T> }, itemData: T, key: string) => {
                result[key] = this.makeRecordDataWrapperFromData(key, itemData)
            },
            {}
        );
        this.CACHED_RECORDS_DATA_WRAPPERS = recordsDataWrappers;
        this.triggerSubscribers();
        return _.mapValues(recordsDataWrappers, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
    }

    loadRecordsFromJsonifiedData(jsonifiedRecordsData: any): { [recordId: string]: RecordOf<T> } | null {
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


export interface ObjectFieldProps extends BaseFieldProps {
    retrieveDataCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export class ObjectField<T> extends BaseObjectField<T> {
    public CACHED_RECORDS_DATA_WRAPPERS?: { [key: string]: RecordDataWrapper<T> };
    private pendingRetrievalPromise?: Promise<{ [key: string]: RecordOf<T> } | null>;

    constructor(public readonly props: ObjectFieldProps) {
        super(props);
    }

    retrieveAndCacheRecords(): Promise<{ [key: string]: RecordOf<T> } | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<{ [key: string]: RecordOf<T> } | null> = this.props.retrieveDataCallable().then(responseData => {
                this.pendingRetrievalPromise = undefined;
                if (responseData.success === true) {
                    const recordsDataWrappers: { [key: string]: RecordDataWrapper<T> } = _.transform(
                        responseData.data as { [key: string]: T },
                        (result: { [key: string]: RecordDataWrapper<T> }, itemData: T, recordKey: string) => {
                            result[recordKey] = this.makeRecordDataWrapperFromData(recordKey, itemData);
                        },
                        {}
                    );
                    this.CACHED_RECORDS_DATA_WRAPPERS = recordsDataWrappers;
                    this.triggerSubscribers();
                    return _.mapValues(recordsDataWrappers, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
                } else {
                    this.props.onRetrievalFailure?.(responseData);
                    return null;
                }
            });
            this.pendingRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getRecords(): Promise<{ [key: string]: RecordOf<T> } | null> {
        return this.CACHED_RECORDS_DATA_WRAPPERS !== undefined ? _.mapValues(this.CACHED_RECORDS_DATA_WRAPPERS, (
            (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA)
        ): this.retrieveAndCacheRecords();
    }

    async getSingleRecord(key: string): Promise<RecordOf<T> | undefined> {
        const records: { [key: string]: RecordOf<T> } = await this.getRecords();
        return records != null ? records[key] : undefined;
    }
}

export class ChildObjectField<T> extends BaseObjectField<T> {
    public CACHED_RECORDS_DATA_WRAPPERS?: { [key: string]: RecordDataWrapper<T> };
    private parentField?: ContainerField<any>;

    constructor(public readonly props: BaseFieldProps) {
        super(props);
    }

    registerParentField(parentField: ContainerField<any>) {
        this.parentField = parentField;
    }

    loadDataToRecords(data: { [key: string]: T }): { [key: string]: RecordOf<T> } {
        const recordsDataWrappers: { [key: string]: RecordDataWrapper<T> } = _.mapValues(
            data, (itemData: T, recordKey: string) => this.makeRecordDataWrapperFromData(recordKey, itemData)
        );
        this.CACHED_RECORDS_DATA_WRAPPERS = recordsDataWrappers;
        this.triggerSubscribers();
        return _.mapValues(recordsDataWrappers, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
    }

    async retrieveAndCacheRecords(): Promise<{ [key: string]: RecordOf<T> } | null> {
        if (this.parentField !== undefined) {
            await this.parentField.retrieveAndCacheRecordsIntoChildren();
            return _.mapValues(this.CACHED_RECORDS_DATA_WRAPPERS, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
        } else {
            console.error("parentField not registered in following ChildObjectField :");
            console.error(this);
            return null;
        }
    }

    async getRecords(): Promise<{ [key: string]: RecordOf<T> } | null> {
        return this.CACHED_RECORDS_DATA_WRAPPERS !== undefined ? _.mapValues(this.CACHED_RECORDS_DATA_WRAPPERS, (
            (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA)
        ) : this.retrieveAndCacheRecords();
    }
}


export interface SectionedObjectFieldProps extends BaseFieldProps {
    retrieveItemCallable: (key: string) => Promise<any>;
    retrieveMultipleItemsCallable?: (keys: string[]) => Promise<any>;
    onItemRetrievalFailure?: (responseData: any) => any;
}

export class SectionedObjectField<T> extends BaseObjectField<T> {
    public CACHED_RECORDS_DATA_WRAPPERS: { [key: string]: RecordDataWrapper<T> };
    private readonly pendingKeyItemsRetrievalPromises: { [key: string]: Promise<RecordOf<T> | null> };

    constructor(public readonly props: SectionedObjectFieldProps) {
        super(props);
        this.CACHED_RECORDS_DATA_WRAPPERS = {};
        this.pendingKeyItemsRetrievalPromises = {};
    }

    retrieveAndCacheRecordItem(recordKey: string): Promise<RecordOf<T> | null>  {
        const existingPendingPromise: Promise<RecordOf<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[recordKey];
        if (existingPendingPromise !== undefined) {
            return existingPendingPromise;
        } else {
            const retrievalPromise: Promise<RecordOf<T> | null> = this.props.retrieveItemCallable(recordKey).then(responseData => {
                delete this.pendingKeyItemsRetrievalPromises[recordKey];
                if (responseData.success === true && responseData.data !== undefined) {
                    const recordDataWrapper: RecordDataWrapper<T> = this.makeRecordDataWrapperFromData(recordKey, responseData.data as T);
                    this.internalCreateUpdateRecordItem(recordKey, recordDataWrapper.RECORD_DATA);

                    this.triggerSubscribers();
                    this.triggerSubscribersForKey(recordKey);
                    return recordDataWrapper.RECORD_DATA;
                } else {
                    this.props.onItemRetrievalFailure?.(responseData);
                    this.triggerSubscribers();
                    this.triggerSubscribersForKey(recordKey);
                    return null;
                }
            });
            this.pendingKeyItemsRetrievalPromises[recordKey] = retrievalPromise;
            return retrievalPromise;
        }
    }

    async retrieveAndCacheMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: RecordOf<T> | null }>  {
        const keysRequiringRetrieval: string[] = [];
        const keysPromises: Promise<{ key: string, record: RecordOf<T> | null }>[] = [];
        recordKeys.forEach((key: string) => {
            const existingKeyPendingPromise: Promise<RecordOf<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[key];
            if (existingKeyPendingPromise !== undefined) {
                keysPromises.push(existingKeyPendingPromise.then((record: RecordOf<T> | null) => ({key, record})));
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            const baseMultiItemsRetrievalPromise = this.props.retrieveMultipleItemsCallable(keysRequiringRetrieval);
            keysRequiringRetrieval.forEach((recordKey: string) => {
                const keyItemRetrievalPromise: Promise<RecordOf<T> | null> = baseMultiItemsRetrievalPromise.then(responseData => {
                    delete this.pendingKeyItemsRetrievalPromises[recordKey];
                    if (responseData.success === true && responseData.data !== undefined) {
                        const itemsDataContainer: { [itemKey: string]: { [attrKey: string]: any } } = responseData.data;
                        const itemData: { [attrKey: string]: any } | undefined = itemsDataContainer[recordKey];
                        if (itemData !== undefined) {
                            const recordDataWrapper: RecordDataWrapper<T> = this.makeRecordDataWrapperFromData(recordKey, itemData as T);
                            this.internalCreateUpdateRecordItem(recordKey, recordDataWrapper.RECORD_DATA);
                            this.triggerSubscribersForKey(recordKey);
                            return recordDataWrapper.RECORD_DATA;
                        }
                    }
                    this.props.onItemRetrievalFailure?.(responseData);
                    this.triggerSubscribersForKey(recordKey);
                    return null;
                });
                this.pendingKeyItemsRetrievalPromises[recordKey] = keyItemRetrievalPromise;
                keysPromises.push(keyItemRetrievalPromise.then((record: RecordOf<T> | null) => ({key: recordKey, record})));
            });
        }
        const keysContainers: { key: string, record: RecordOf<T> | null }[] = await Promise.all(keysPromises);
        this.triggerSubscribers();
        return _.transform(keysContainers, (result: { [key: string]: any }, container: { key: string, record: RecordOf<T> | null }) => {
            result[container.key] = container.record;
        }, {});
    }

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: RecordOf<T> | null }> {
        const keysRequiringRetrieval: string[] = [];
        const existingRecordsItems: { [key: string]: RecordOf<T> } = {};
        if (this.CACHED_RECORDS_DATA_WRAPPERS === undefined) {
            keysRequiringRetrieval.push(...recordKeys);
        } else {
            recordKeys.forEach((key: string) => {
                const existingRecordDataWrapper: RecordDataWrapper<T> | undefined = this.CACHED_RECORDS_DATA_WRAPPERS[key];
                if (existingRecordDataWrapper !== undefined) {
                    existingRecordsItems[key] = existingRecordDataWrapper.RECORD_DATA;
                } else {
                    keysRequiringRetrieval.push(key);
                }
            });
        }
        if (keysRequiringRetrieval.length > 0) {
            const retrievedRecordsItems: { [key: string]: RecordOf<T> | null} = (
                await this.retrieveAndCacheMultipleRecordItems(keysRequiringRetrieval)
            );
            return {...existingRecordsItems, ...retrievedRecordsItems};
        } else {
            return existingRecordsItems;
        }
    }

    async getRecordItem(key: string): Promise<RecordOf<T> | null> {
        return (this.CACHED_RECORDS_DATA_WRAPPERS[key] !== undefined ?
                this.CACHED_RECORDS_DATA_WRAPPERS[key].RECORD_DATA : this.retrieveAndCacheRecordItem(key)
        );
    }
}