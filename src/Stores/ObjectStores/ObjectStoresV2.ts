import {F, O, S} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import ContainerStore from "../ContainerStore";
import RecordDataWrapper from "../../RecordDataWrapper";
import BaseObjectStore, {BaseObjectProps} from "./BaseObjectStore";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../DataProcessors";
import RecordSubscriptionsWrapper from "../../RecordSubscriptionsWrapper";
import BaseObjectStoreV2 from "./BaseObjectStoreV2";


export interface ObjectStoreProps extends BaseObjectProps {
    retrieveDataCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export class ObjectStoreV2<T> extends BaseObjectStoreV2<T> {
    public CACHED_DATA_WRAPPER?: RecordDataWrapper<T>;
    private pendingRetrievalPromise?: Promise<immutable.RecordOf<T> | null>;

    constructor(public readonly props: ObjectStoreProps) {
        super(props);
    }

    protected getMatchingDataWrapper(attrFieldPath: string): { dataWrapper: RecordDataWrapper<T>; relativeAttrKeyPath: string } {
        return {dataWrapper: this.CACHED_DATA_WRAPPER, relativeAttrKeyPath: attrFieldPath};
    }

    retrieveAndCacheData(attrPathElements: string[]): Promise<immutable.RecordOf<T> | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<immutable.RecordOf<T> | null> = this.props.retrieveDataCallable().then(responseData => {
                this.pendingRetrievalPromise = undefined;
                if (responseData.success === true) {
                    const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
                        responseData.data as T, this.props.itemModel
                    ) as immutable.RecordOf<T>;
                    this.CACHED_DATA_WRAPPER = new RecordDataWrapper<T>(
                        new RecordSubscriptionsWrapper<T>(this),
                        recordItem, this.props.itemModel
                    );
                    this.triggerSubscribers();
                    return recordItem;
                } else {
                    this.props.onRetrievalFailure?.(responseData);
                    return null;
                }
            });
            this.pendingRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getRecords(): Promise<{ [key: string]: immutable.RecordOf<T> } | null> {
        return this.CACHED_RECORDS_DATA_WRAPPERS !== undefined ? _.mapValues(this.CACHED_RECORDS_DATA_WRAPPERS, (
            (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA
        )): this.retrieveAndCacheRecords();
    }

    async getSingleRecord(key: string): Promise<immutable.RecordOf<T> | undefined> {
        const records: { [key: string]: immutable.RecordOf<T> } | null = await this.getRecords();
        return records != null ? records[key] : undefined;
    }
}

export class ChildObjectStore<T> extends BaseObjectStore<T> {
    public CACHED_RECORDS_DATA_WRAPPERS?: { [key: string]: RecordDataWrapper<T> };
    private parentField?: ContainerStore<any>;

    constructor(public readonly props: BaseObjectProps) {
        super(props);
    }

    registerParentField(parentField: ContainerStore<any>) {
        this.parentField = parentField;
    }

    loadDataToRecords(data: { [key: string]: T }): { [key: string]: immutable.RecordOf<T> } {
        const recordsDataWrappers: { [key: string]: RecordDataWrapper<T> } = _.mapValues(
            data, (itemData: T, recordKey: string) => this.makeRecordDataWrapperFromData(recordKey, itemData)
        );
        this.CACHED_RECORDS_DATA_WRAPPERS = recordsDataWrappers;
        this.triggerSubscribers();
        return _.mapValues(recordsDataWrappers, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
    }

    async retrieveAndCacheRecords(): Promise<{ [key: string]: immutable.RecordOf<T> } | null> {
        if (this.parentField !== undefined) {
            await this.parentField.retrieveAndCacheRecordsIntoChildren();
            return _.mapValues(this.CACHED_RECORDS_DATA_WRAPPERS, (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA);
        } else {
            console.error("parentField not registered in following ChildObjectStore :");
            console.error(this);
            return null;
        }
    }

    async getRecords(): Promise<{ [key: string]: immutable.RecordOf<T> } | null> {
        return this.CACHED_RECORDS_DATA_WRAPPERS !== undefined ? _.mapValues(this.CACHED_RECORDS_DATA_WRAPPERS, (
            (recordDataWrapperItem: RecordDataWrapper<T>) => recordDataWrapperItem.RECORD_DATA)
        ) : this.retrieveAndCacheRecords();
    }

    async getSingleRecord(key: string): Promise<immutable.RecordOf<T> | undefined> {
        const records: { [key: string]: immutable.RecordOf<T> } | null = await this.getRecords();
        return records != null ? records[key] : undefined;
    }
}


export interface SectionedObjectFieldProps extends BaseObjectProps {
    retrieveItemCallable: (key: string) => Promise<any>;
    retrieveMultipleItemsCallable?: (keys: string[]) => Promise<any>;
    onItemRetrievalFailure?: (responseData: any) => any;
}

export class SectionedObjectStore<T> extends BaseObjectStoreV2<T> {
    public CACHED_RECORDS_DATA_WRAPPERS: { [key: string]: RecordDataWrapper<T> };
    private readonly pendingKeyItemsRetrievalPromises: { [key: string]: Promise<immutable.RecordOf<T> | null> };

    constructor(public readonly props: SectionedObjectFieldProps) {
        super(props);
        this.CACHED_RECORDS_DATA_WRAPPERS = {};
        this.pendingKeyItemsRetrievalPromises = {};
    }

    protected getMatchingDataWrapper<P extends string>(attrKeyPath: F.AutoPath<T, P>): {
        dataWrapper: RecordDataWrapper<T>, relativeAttrKeyPath: F.AutoPath<T, P>
    } {
        const attrKeyPathParts: string[] = attrKeyPath.split('.');
        // this.CACHED_RECORDS_DATA_WRAPPERS[attrKeyPathParts[0]] = this.makeRecordDataWrapperFromItem(attrKeyPathParts[0], recordItem);
        const dataWrapper = this.CACHED_RECORDS_DATA_WRAPPERS[attrKeyPathParts[0]];
        const relativeAttrKeyPath = attrKeyPathParts.slice(1).join('.') as F.AutoPath<T, P>;
        return {dataWrapper, relativeAttrKeyPath};
    }

    makeRecordDataWrapperFromItem(recordKey: string, recordItem: immutable.RecordOf<T>): RecordDataWrapper<T> {
        const matchingRecordSubscriptions: RecordSubscriptionsWrapper<T> = this.makeGetRecordSubscriptionsWrapper(recordKey);
        return new RecordDataWrapper<T>(matchingRecordSubscriptions, recordItem, this.props.itemModel);
    }

    makeRecordDataWrapperFromData(recordKey: string, recordData: T): RecordDataWrapper<T> | null {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(recordData, this.props.itemModel) as immutable.RecordOf<T>;
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordKey, recordItem) : null;
    }

    protected internalCreateUpdateRecordItem(recordKey: string, recordItem: immutable.RecordOf<T>): immutable.RecordOf<T> | undefined {
        const existingRecordDataWrapper: RecordDataWrapper<T> | undefined = this.CACHED_RECORDS_DATA_WRAPPERS[recordKey];
        this.CACHED_RECORDS_DATA_WRAPPERS[recordKey] = this.makeRecordDataWrapperFromItem(recordKey, recordItem);
        return existingRecordDataWrapper?.RECORD_DATA;
    }

    retrieveAndCacheData(attrPathElements: string[]): Promise<immutable.RecordOf<T> | null>  {
        const existingPendingPromise: Promise<immutable.RecordOf<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[recordKey];
        if (existingPendingPromise !== undefined) {
            return existingPendingPromise;
        } else {
            const recordKey: string = attrPathElements[0];
            const retrievalPromise: Promise<immutable.RecordOf<T> | null> = this.props.retrieveItemCallable(recordKey).then(responseData => {
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

    async retrieveAndCacheMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: immutable.RecordOf<T> | null }>  {
        const keysRequiringRetrieval: string[] = [];
        const keysPromises: Promise<{ key: string, record: immutable.RecordOf<T> | null }>[] = [];
        recordKeys.forEach((key: string) => {
            const existingKeyPendingPromise: Promise<immutable.RecordOf<T> | null> | undefined = this.pendingKeyItemsRetrievalPromises[key];
            if (existingKeyPendingPromise !== undefined) {
                keysPromises.push(existingKeyPendingPromise.then((record: immutable.RecordOf<T> | null) => ({key, record})));
            } else {
                keysRequiringRetrieval.push(key);
            }
        });
        if (keysRequiringRetrieval.length > 0) {
            const baseMultiItemsRetrievalPromise = this.props.retrieveMultipleItemsCallable(keysRequiringRetrieval);
            keysRequiringRetrieval.forEach((recordKey: string) => {
                const keyItemRetrievalPromise: Promise<immutable.RecordOf<T> | null> = baseMultiItemsRetrievalPromise.then(responseData => {
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
                keysPromises.push(keyItemRetrievalPromise.then((record: immutable.RecordOf<T> | null) => ({key: recordKey, record})));
            });
        }
        const keysContainers: { key: string, record: immutable.RecordOf<T> | null }[] = await Promise.all(keysPromises);
        this.triggerSubscribers();
        return _.transform(keysContainers, (result: { [key: string]: any }, container: { key: string, record: immutable.RecordOf<T> | null }) => {
            result[container.key] = container.record;
        }, {});
    }

    async getMultipleRecordItems(recordKeys: string[]): Promise<{ [key: string]: immutable.RecordOf<T> | null }> {
        const keysRequiringRetrieval: string[] = [];
        const existingRecordsItems: { [key: string]: immutable.RecordOf<T> } = {};
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
            const retrievedRecordsItems: { [key: string]: immutable.RecordOf<T> | null} = (
                await this.retrieveAndCacheMultipleRecordItems(keysRequiringRetrieval)
            );
            return {...existingRecordsItems, ...retrievedRecordsItems};
        } else {
            return existingRecordsItems;
        }
    }

    async getRecordItem(key: string): Promise<immutable.RecordOf<T> | null> {
        return (this.CACHED_RECORDS_DATA_WRAPPERS[key] !== undefined ?
                this.CACHED_RECORDS_DATA_WRAPPERS[key].RECORD_DATA : this.retrieveAndCacheRecordItem(key)
        );
    }
}