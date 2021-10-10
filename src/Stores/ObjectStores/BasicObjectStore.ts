import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import RecordDataWrapper from "../../RecordDataWrapper";
import {BaseObjectProps} from "./BaseObjectStore";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../DataProcessors";
import BaseObjectStoreV2 from "./BaseObjectStoreV2";
import {MapModel} from "../../ModelsFields";


export interface BasicObjectStoreProps extends BaseObjectProps {
    objectModel: MapModel;
    retrieveDataCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export class BasicObjectStore<T extends { [p: string]: any }> extends BaseObjectStoreV2<T> {
    public CACHED_DATA_WRAPPER?: RecordDataWrapper<T>;
    private pendingRetrievalPromise?: Promise<RecordDataWrapper<T> | null>;

    constructor(public readonly props: BasicObjectStoreProps) {
        super(props);
    }

    retrieveAndCacheData(): Promise<RecordDataWrapper<T> | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<RecordDataWrapper<T> | null> = this.props.retrieveDataCallable().then(responseData => {
                this.pendingRetrievalPromise = undefined;
                if (responseData.success === true) {
                    const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
                        responseData.data as T, this.props.objectModel
                    ) as immutable.RecordOf<T>;
                    this.CACHED_DATA_WRAPPER = new RecordDataWrapper<T>(this, recordItem, this.props.objectModel);
                    this.triggerSubscribers();
                    return this.CACHED_DATA_WRAPPER;
                } else {
                    this.props.onRetrievalFailure?.(responseData);
                    return null;
                }
            });
            this.pendingRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getData(): Promise<RecordDataWrapper<T> | null> {
        return this.CACHED_DATA_WRAPPER !== undefined ? this.CACHED_DATA_WRAPPER : this.retrieveAndCacheData();
    }

    loadFromData(parsedData: T): { item: immutable.RecordOf<T> | undefined, subscribersPromise: Promise<any> } {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
            parsedData, this.props.objectModel
        ) as immutable.RecordOf<T>;
        if (recordItem != null) {
            this.CACHED_DATA_WRAPPER = new RecordDataWrapper<T>(this, recordItem, this.props.objectModel);
            const subscribersPromise: Promise<any> = this.triggerSubscribers();
            return {item: recordItem, subscribersPromise};
        }
        return {item: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    loadFromJsonifiedData(jsonifiedData: any): { item: immutable.RecordOf<T> | undefined, subscribersPromise: Promise<any> } {
        try {
            const parsedData: any = JSON.parse(jsonifiedData);
            if (_.isPlainObject(parsedData)) {
                return this.loadFromData(parsedData);
            } else {
                console.warn(`Parsed data was not a plain object and could not be loaded`);
            }
        } catch (e) {
            console.warn(`JSON Parsing error in loading the jsonified data : ${e}`);
        }
        return {item: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<O.Path<T, S.Split<P, ".">>> {
        const dataWrapper: RecordDataWrapper<T> = await this.getData();
        return dataWrapper.getAttr<P>(attrKeyPath);
    }

    async getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<U.Merge<O.P.Pick<T, S.Split<P, ".">>>> {
        const dataWrapper: RecordDataWrapper<T> = await this.getData();
        return dataWrapper.getMultipleAttrs<P>(attrsKeyPaths);
    }

    async updateAttrWithReturnedSubscribersPromise<P extends string>(attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>): (
        Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }>
    ) {
        const dataWrapper: RecordDataWrapper<T> = await this.getData();
        return dataWrapper.updateAttr<P>(attrKeyPath, value);
    }

    async updateMultipleAttrs<P extends string>(
        mutators: Partial<O.P.Pick<T, S.Split<P, ".">>>
    ): Promise<U.Merge<O.P.Pick<T, S.Split<P, ".">>> | undefined> {
        const dataWrapper: RecordDataWrapper<T> = await this.getData();
        const response = dataWrapper.updateMultipleAttrs<P>(mutators);
        return response !== undefined ? response : {oldValues: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async deleteAttrWithReturnedSubscribersPromise<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<{ subscribersPromise: Promise<any> }> {
        const dataWrapper: RecordDataWrapper<T> = await this.getData();
        const response = dataWrapper.deleteAttr<P>(attrKeyPath);
        return response !== undefined ? response : {subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async removeAttrWithReturnedSubscribersPromise<P extends string>(attrKeyPath: F.AutoPath<T, P>): (
        Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }>
    ) {
        const dataWrapper: RecordDataWrapper<T> = await this.getData();
        const response = dataWrapper.removeAttr<P>(attrKeyPath);
        return response !== undefined ? response : {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }
}