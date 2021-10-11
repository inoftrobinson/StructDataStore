import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {BaseObjectProps} from "./BaseObjectStore";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../DataProcessors";
import BaseObjectStoreV2 from "./BaseObjectStoreV2";
import {MapModel} from "../../ModelsFields";
import ImmutableRecordWrapper from "../../ImmutableRecordWrapper";
import {ObjectFlattenedRecursiveMutatorsResults, ObjectOptionalFlattenedRecursiveMutators} from "../../types";


export interface BasicObjectStoreProps extends BaseObjectProps {
    objectModel: MapModel;
    retrieveDataCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export default class BasicObjectStore<T extends { [p: string]: any }> extends BaseObjectStoreV2<T> {
    public RECORD_WRAPPER?: ImmutableRecordWrapper<T>;
    private pendingRetrievalPromise?: Promise<ImmutableRecordWrapper<T> | null>;

    constructor(public readonly props: BasicObjectStoreProps) {
        super(props);
    }

    retrieveAndCacheData(): Promise<ImmutableRecordWrapper<T> | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<ImmutableRecordWrapper<T> | null> = this.props.retrieveDataCallable().then(responseData => {
                this.pendingRetrievalPromise = undefined;
                if (responseData.success === true) {
                    const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
                        responseData.data as T, this.props.objectModel
                    ) as immutable.RecordOf<T>;
                    this.RECORD_WRAPPER = new ImmutableRecordWrapper<T>(this, recordItem, this.props.objectModel);
                    this.triggerSubscribers();
                    return this.RECORD_WRAPPER;
                } else {
                    this.props.onRetrievalFailure?.(responseData);
                    return null;
                }
            });
            this.pendingRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getRecordWrapper(): Promise<ImmutableRecordWrapper<T> | null> {
        return this.RECORD_WRAPPER !== undefined ? this.RECORD_WRAPPER : this.retrieveAndCacheData();
    }

    loadFromData(parsedData: T): { item: immutable.RecordOf<T> | undefined, subscribersPromise: Promise<any> } {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
            parsedData, this.props.objectModel
        ) as immutable.RecordOf<T>;
        if (recordItem != null) {
            this.RECORD_WRAPPER = new ImmutableRecordWrapper<T>(this, recordItem, this.props.objectModel);
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
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            return recordWrapper.getAttr<P>(attrKeyPath);
        }
        return undefined;
    }

    async getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<U.Merge<O.P.Pick<T, S.Split<P, ".">>>> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            return recordWrapper.getMultipleAttrs<P>(attrsKeyPaths);
        }
        return undefined;
    }

    async updateAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValue: O.Path<T, S.Split<P, '.'>> | undefined = recordWrapper.updateAttr(attrKeyPath, value);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined; subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValues = recordWrapper.updateMultipleAttrs<M>(mutators);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(Object.keys(mutators));
            return {oldValues, subscribersPromise};
        }
        return {oldValues: undefined as any, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async updateDataToAttrWithReturnedSubscribersPromise<P>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, ".">>
    ): Promise<{ oldValue: Path<T, Split<P, ".">> | undefined; subscribersPromise: Promise<any> }> {
        // todo: implement
        return Promise.resolve(undefined);
    }

    async updateDataToMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined; subscribersPromise: Promise<any> }> {
        // todo: implement
        return Promise.resolve(undefined);
    }

    async deleteAttrWithReturnedSubscribersPromise<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<{ subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            recordWrapper.deleteAttr<P>(attrKeyPath);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
            return {subscribersPromise};
        }
        return {subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            recordWrapper.deleteMultipleAttrs(attrsKeyPaths);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
            return {subscribersPromise};
        }
        return {subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValue = recordWrapper.removeAttr<P>(attrKeyPath);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ removedValues: U.Merge<O.Pick<T, S.Split<P, ".">>> | undefined; subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const removedValues = recordWrapper.removeMultipleAttrs(attrsKeyPaths);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
            return {removedValues, subscribersPromise};
        }
        return {removedValues: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }
}