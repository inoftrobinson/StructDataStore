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
import {
    navigateToAttrKeyPathPartsIntoMapModel
} from "../../utils/fieldsNavigation";
import {
    BaseDataRetrievalPromiseResult,
    TypedAttrGetter,
    TypedImmutableAttrSetter,
    TypedAttrSetter,
    TypedAttrRemover, TypedAttrSelector
} from "../../models";
import {
    renderAttrKeyPathWithQueryKwargs,
} from "../../utils/attrKeyPaths";
import {at} from "lodash";
import {RenderedTypedAttrSetter, RenderedTypedImmutableAttrSetter} from "../../internalModels";

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

    loadFromDataWithReturnedSubscribersPromise(parsedData: T): { success: boolean, subscribersPromise: Promise<any> } {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel(
            parsedData, this.props.objectModel
        ) as immutable.RecordOf<T>;
        if (recordItem != null) {
            this.RECORD_WRAPPER = new ImmutableRecordWrapper<T>(recordItem, this.props.objectModel);
            const subscribersPromise: Promise<any> = this.triggerSubscribers();
            return {success: true, subscribersPromise};
        }
        return {success: false, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    protected async _getAttr<P extends string>(
        renderedAttrKeyPathParts: string[]
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, ".">>> | undefined> {
    // async getAttr<P extends O.Paths<T>>(attrKeyPath: P, queryKwargs?: { [argKey: string]: any }): Promise<ImmutableCast<O.Path<T, P>> | undefined> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        return recordWrapper != null ? recordWrapper.getAttr(renderedAttrKeyPathParts) : undefined;
    }

    /*async _getMultipleAttrs<P extends string>(
        getters: (F.AutoPath<T, P> | TypedAttrGetter<T, P>)[]
    ): Promise<O.Nullable<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, ".">>>>>>;*/
    protected async _getMultipleAttrs<P extends string>(
        getters: { [getterKey: string]: string[] }
    ): Promise<{ [getterKey: string]: any | undefined }> {
    // Promise<O.Nullable<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, ".">>>>>> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        return recordWrapper != null ? recordWrapper.getMultipleAttrs(getters) : {};  // as O.Nullable<U.Merge<O.P.Pick<T, S.Split<P, ".">>>>;
    }

    protected async _updateAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[], valueToSet: ImmutableCast<F.AutoPath<T, P>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValue: O.Path<T, S.Split<P, '.'>> | undefined = recordWrapper.updateAttr(renderedAttrKeyPathParts, valueToSet);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAttrKeyPathParts);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    /*async updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValues: { [attrKeyPath: string]: any } = recordWrapper.updateMultipleAttrs(mutators);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(Object.keys(mutators));
            return {oldValues: oldValues as ObjectFlattenedRecursiveMutatorsResults<T, M>, subscribersPromise};
        }
        return {oldValues: undefined as any, subscribersPromise: new Promise<void>(resolve => resolve())};
    }*/

    protected async _updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: RenderedTypedImmutableAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const mutatorsRenderedAttrKeyPathsParts: string[][] = [];
            const oldValues: { [setterKey: string]: any | undefined } = _.mapValues(setters, (setterItem: RenderedTypedImmutableAttrSetter<T, P>) => {
                const setterOldValue: any | undefined = recordWrapper.updateAttr(setterItem.renderedAttrKeyPathParts, setterItem.valueToSet);
                mutatorsRenderedAttrKeyPathsParts.push(setterItem.renderedAttrKeyPathParts);
                return setterOldValue;
            });
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(mutatorsRenderedAttrKeyPathsParts);
            return {oldValues, subscribersPromise};
        }
        const emptyOldValues: { [setterKey: string]: undefined } = _.mapValues(setters, () => undefined);
        return {oldValues: emptyOldValues, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    protected async _updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[], valueToSet: F.AutoPath<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, ".">>> | undefined; subscribersPromise: Promise<any> }> {
    /*async updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, P>> | undefined, subscribersPromise: Promise<any> }> {*/

        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = (
            navigateToAttrKeyPathPartsIntoMapModel(this.props.objectModel, renderedAttrKeyPathParts)
        );
        if (matchingField != null) {
            const loadedValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> = matchingField.dataLoader(valueToSet);
            return await this._updateAttrWithReturnedSubscribersPromise<P>(renderedAttrKeyPathParts, loadedValue);
        } else {
            console.error(`${renderedAttrKeyPathParts} was not a valid path`);
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async _updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: RenderedTypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {
        // We use a transform instead of a mapValues, because we do not want to add setters for attributes with invalid attr path.
        const loadedSetters: { [setterKey: string]: RenderedTypedImmutableAttrSetter<T, P> } = _.transform(setters,
            (output: { [setterKey: string]: RenderedTypedImmutableAttrSetter<T, P> }, setterItem: RenderedTypedAttrSetter<T, P>, setterKey: string) => {
                const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = (
                    navigateToAttrKeyPathPartsIntoMapModel(this.props.objectModel, setterItem.renderedAttrKeyPathParts)
                );
                if (matchingField != null) {
                    const loadedValue: ImmutableCast<O.Path<T, P>> = matchingField.dataLoader(setterItem.valueToSet);
                    output[setterKey] = {renderedAttrKeyPathParts: setterItem.renderedAttrKeyPathParts, valueToSet: loadedValue};
                } else {
                    console.error(`${setterItem.renderedAttrKeyPathParts} was not a valid path`);
                }
            }
        );
        return await this._updateMultipleAttrsWithReturnedSubscribersPromise<P>(loadedSetters);
    }

    async _deleteAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            recordWrapper.deleteAttr(renderedAttrKeyPathParts);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAttrKeyPathParts);
            return {subscribersPromise};
        }
        return {subscribersPromise: Promise.resolve(undefined)};
    }

    protected async _deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removersRenderedAttrsKeyPathsParts: string[][]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            recordWrapper.deleteMultipleAttrs(removersRenderedAttrsKeyPathsParts);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(removersRenderedAttrsKeyPathsParts);
            return {subscribersPromise};
        }
        return {subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    protected async _removeAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[]
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const oldValue = recordWrapper.removeAttr(renderedAttrKeyPathParts);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAttrKeyPathParts);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    protected async _removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        renderedRemovers: { [removerKey: string]: string[] }
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined; subscribersPromise: Promise<any> }> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const removedValues: { [removerKey: string]: any | undefined } = recordWrapper.removeMultipleAttrs(renderedRemovers);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(_.values(renderedRemovers));
            return {removedValues, subscribersPromise};
        }
        return {removedValues: undefined, subscribersPromise: new Promise<void>(resolve => resolve())};
    }
}