import * as _ from 'lodash';
import * as immutable from 'immutable';
import {F, O, S, U} from 'ts-toolbelt';
import {BaseObjectStore, BaseObjectStoreProps} from "./BaseObjectStore";
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../DataProcessors";
import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../../ModelsFields";
import ImmutableRecordWrapper from "../../ImmutableRecordWrapper";
import {
    ImmutableCast,
    ObjectFlattenedRecursiveMutatorsResults,
    ObjectOptionalFlattenedRecursiveMutators
} from "../../types";
import {navigateToAttrKeyPathIntoMapModelV2} from "../../utils/fieldsNavigation";
import {BaseDataRetrievalPromiseResult, TypedAttrGetter} from "../../models";
import {separatePotentialGetterWithQueryKwargs} from "../../utils/attrKeyPaths";
import {at} from "lodash";

export type RetrieveDataCallablePromiseResult<T> = BaseDataRetrievalPromiseResult<T>;

export interface BasicObjectStoreProps<T> extends BaseObjectStoreProps {
    objectModel: MapModel;
    retrieveDataCallable: () => Promise<RetrieveDataCallablePromiseResult<T>>;
    onRetrievalFailure?: (responseData: any) => any;
}

export
// @ts-ignore
class BasicObjectStore<T extends { [p: string]: any }> extends BaseObjectStore<T> {
    public RECORD_WRAPPER?: ImmutableRecordWrapper<T>;
    private pendingRetrievalPromise?: Promise<ImmutableRecordWrapper<T> | null>;

    constructor(public readonly props: BasicObjectStoreProps<T>) {
        super(props);
    }

    retrieveAndCacheData(): Promise<ImmutableRecordWrapper<T> | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<ImmutableRecordWrapper<T> | null> = this.props.retrieveDataCallable().then((result: RetrieveDataCallablePromiseResult<T>) => {
                this.pendingRetrievalPromise = undefined;
                if (result.success) {
                    const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
                        result.data, this.props.objectModel
                    ) as immutable.RecordOf<T>;
                    this.RECORD_WRAPPER = new ImmutableRecordWrapper<T>(recordItem, this.props.objectModel);
                    this.triggerSubscribers();
                    return this.RECORD_WRAPPER;
                } else {
                    this.props.onRetrievalFailure?.(result.metadata);
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

    loadFromData(parsedData: T): { subscribersPromise: Promise<any> } {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
            parsedData, this.props.objectModel
        ) as immutable.RecordOf<T>;
        if (recordItem != null) {
            this.RECORD_WRAPPER = new ImmutableRecordWrapper<T>(recordItem, this.props.objectModel);
            const subscribersPromise: Promise<any> = this.triggerSubscribers();
            return {subscribersPromise};
        }
        return {subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async getAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P> | TypedAttrGetter<T, P>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, ".">>> | undefined> {
    // async getAttr<P extends O.Paths<T>>(attrKeyPath: P, queryKwargs?: { [argKey: string]: any }): Promise<ImmutableCast<O.Path<T, P>> | undefined> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const renderedAttrKeyPathParts: string[] = separatePotentialGetterWithQueryKwargs(attrKeyPath);
            return recordWrapper.getAttr(renderedAttrKeyPathParts);
        }
        return undefined;
    }

    async getMultipleAttrs<P extends string>(
        getters: (F.AutoPath<T, P> | TypedAttrGetter<T, P>)[]
    ): Promise<O.Nullable<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, ".">>>>>>;
    async getMultipleAttrs<P extends string>(
        getters: { [getterKey: string]: F.AutoPath<T, P> | TypedAttrGetter<T, P> }
    ): Promise<O.Nullable<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, ".">>>>>> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            return recordWrapper.getMultipleAttrs(getters) as O.Nullable<U.Merge<O.P.Pick<T, S.Split<P, ".">>>>;
        }
        return {} as O.Nullable<U.Merge<O.P.Pick<T, S.Split<P, '.'>>>>;
    }

    async updateAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P> | TypedAttrGetter<T, P>, value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const renderedAttrKeyPathParts: string[] = separatePotentialGetterWithQueryKwargs(attrKeyPath);
            // const renderedAttrKeyPath: string = renderedAttrKeyPathParts.join('.');
            const oldValue: O.Path<T, S.Split<P, '.'>> | undefined = recordWrapper.updateAttr(renderedAttrKeyPathParts, value);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAttrKeyPathParts);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValues: { [attrKeyPath: string]: any } = recordWrapper.updateMultipleAttrs(mutators);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(Object.keys(mutators));
            return {oldValues: oldValues as ObjectFlattenedRecursiveMutatorsResults<T, M>, subscribersPromise};
        }
        return {oldValues: undefined as any, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P> | TypedAttrGetter<T, P>, value: O.Path<T, S.Split<P, ".">>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, ".">>> | undefined; subscribersPromise: Promise<any> }> {
    /*async updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, P>> | undefined, subscribersPromise: Promise<any> }> {*/
        /*const renderedAttrKeyPathParts: string[] = separatePotentialGetterWithQueryKwargs(attrKeyPath);
        const renderedAttrKeyPath: string = renderedAttrKeyPathParts.join('.');*/

        // We directly use the non-rendered attrKeyPath (ether itself if the client has passed a keyPath,
        // or the attrKeyPath property if the client passed an AttrGetter object), because the navigation
        // into a field is not dependant upon having key placeholders path parts, or not.
        // Hence we do not need to render the queryKwargs to the attrKeyPath.
        const nonRenderedAttrKeyPath: F.AutoPath<T, P> = _.isPlainObject(attrKeyPath) ? (attrKeyPath as TypedAttrGetter<T, P>).attrKeyPath : attrKeyPath;
        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = (
            navigateToAttrKeyPathIntoMapModelV2(this.props.objectModel, nonRenderedAttrKeyPath)
        );
        if (matchingField != null) {
            const loadedValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> = matchingField.dataLoader(value);
            return await this.updateAttrWithReturnedSubscribersPromise<P>(attrKeyPath, loadedValue);
        } else {
            console.error(`${attrKeyPath} was not a valid path`);
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async updateDataToMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined; subscribersPromise: Promise<any> }> {
        const loadedMutators: { [mutatorAttrKeyPath: string]: ImmutableCast<any> } = (
            _.transform(mutators, (output: { [mutatorAttrKeyPath: string]: ImmutableCast<any> }, mutatorValue: any, mutatorAttrKeyPath) => {
                const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null  = (
                    navigateToAttrKeyPathIntoMapModelV2(this.props.objectModel, mutatorAttrKeyPath as string)
                );
                if (matchingField != null) {
                    output[mutatorAttrKeyPath] = matchingField.dataLoader(mutatorValue);
                } else {
                    console.error(`${mutatorAttrKeyPath} was not a valid path`);
                }
            })
        );
        return await this.updateMultipleAttrsWithReturnedSubscribersPromise<M>(loadedMutators);
    }

    async deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            recordWrapper.deleteAttr(attrKeyPath);
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
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValue = recordWrapper.removeAttr(attrKeyPath);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    async removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined; subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const removedValues = recordWrapper.removeMultipleAttrs(attrsKeyPaths);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
            return {removedValues, subscribersPromise};
        }
        return {removedValues: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }
}