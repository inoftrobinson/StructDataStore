import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../../DataProcessors";
import {BaseObjectStore, BaseObjectStoreProps} from "../BaseObjectStore";
import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../../../ModelsFields";
import ImmutableRecordWrapper from "../../../ImmutableRecordWrapper";
import {
    ImmutableCast,
    ObjectFlattenedRecursiveMutatorsResults,
    ObjectOptionalFlattenedRecursiveMutators, ObjectOptionalFlattenedRecursiveMutatorsWithoutImmutableCast
} from "../../../types";
import {navigateToAttrKeyPathIntoMapModel, navigateToAttrKeyPathIntoMapModelV2} from "../../../utils/fieldsNavigation";


export interface BaseItemsObjectStoreProps extends BaseObjectStoreProps {
    itemModel: MapModel;
}

export abstract class BaseItemsObjectStore<T extends { [p: string]: any }> extends BaseObjectStore<{ [recordKey: string]: T }> {
    protected constructor(public readonly props: BaseItemsObjectStoreProps) {
        super(props);
    }

    private makeRelativeAttrKeyPath<P extends string>(attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>): {
        itemKey: string, relativeAttrKeyPath: F.AutoPath<T, P> | null
    } {
        const attrKeyPathParts: string[] = attrKeyPath.split('.');
        const relativeAttrKeyPath: F.AutoPath<T, P> | null = (
            attrKeyPathParts.length > 1 ? attrKeyPathParts.slice(1).join('.') as F.AutoPath<T, P> : null
        );
        return {itemKey: attrKeyPathParts[0], relativeAttrKeyPath};
    }

    protected async getMatchingDataWrapper<P extends string>(attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>): (
        Promise<{ dataWrapper: ImmutableRecordWrapper<T> | null, relativeAttrKeyPath: F.AutoPath<T, P> | null }>
    ) {
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        const dataWrapper: ImmutableRecordWrapper<T> | null = await this.getSingleRecordItem(itemKey);
        return {dataWrapper, relativeAttrKeyPath};
    }

    protected makeRecordDataWrapperFromItem(recordItem: immutable.RecordOf<T>): ImmutableRecordWrapper<T> {
        return new ImmutableRecordWrapper<T>(recordItem, this.props.itemModel);
    }

    protected makeRecordWrapperFromData(recordKey: string, recordData: T): ImmutableRecordWrapper<T> | null {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel<T>(recordData, this.props.itemModel);
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordItem) : null;
    }

    protected recordsDataToWrappers(data: { [recordKey: string]: T }): { [recordKey: string]: ImmutableRecordWrapper<T> } {
        return _.transform(data, (result: { [recordKey: string]: ImmutableRecordWrapper<T> | null }, recordData: T, recordKey: string) => {
                result[recordKey] = this.makeRecordWrapperFromData(recordKey, recordData)
            }, {}
        );
    }

    abstract loadFromData(data: { [recordKey: string]: T }): { subscribersPromise: Promise<any> };
    
    abstract getSingleRecordItem(key: string): Promise<ImmutableRecordWrapper<T> | null>;

    abstract getMultipleRecordItems(recordKeys: string[]): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }>;

    async getAttr<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>
    ): Promise<ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                return dataWrapper.getAttr(relativeAttrKeyPath);
            } else {
                return dataWrapper.RECORD_DATA as any;
            }
        }
        return undefined;
    }

    async getRecordItem(recordKey: string): Promise<immutable.RecordOf<T> | undefined> {
        return await this.getAttr(recordKey) as immutable.RecordOf<T>;
    }

    private makeAttrsRelativeKeyPathsByItemsKeys<P extends string>(
        attrsKeyPaths: F.AutoPath<{ [recordKey: string]: T }, P>[]
    ): { [itemKey: string]: F.AutoPath<T, P>[] } {
        return _.transform(attrsKeyPaths,
            (output: { [p: string]: F.AutoPath<T, P>[] }, attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>) => {
                const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
                if (relativeAttrKeyPath != null) {
                    const existingContainer: F.AutoPath<T, P>[] | undefined = output[itemKey];
                    if (existingContainer !== undefined) {
                        existingContainer.push(relativeAttrKeyPath);
                    } else {
                        output[itemKey] = [relativeAttrKeyPath];
                    }
                } else {
                    // todo: handle null relativeAttrKeyPath
                }
            }, {}
        );
    }

    private makeAttrsRelativeMutatorsByItemsKeys<M extends ObjectOptionalFlattenedRecursiveMutators<{ [recordKey: string]: T }>>(
        mutators: M
    ): { [itemKey: string]: { [relativeAttrKeyPath: string]: any } } {
        return _.transform(mutators, (
            output: { [itemKey: string]: { [relativeAttrKeyPath: string]: any } },
            mutatorValue: any, mutatorAttrKeyPath: F.AutoPath<{ [recordKey: string]: T }, any>) => {
                const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(mutatorAttrKeyPath);
                if (relativeAttrKeyPath != null) {
                    const existingContainer: { [relativeAttrKeyPath: string]: any } | undefined = output[itemKey];
                    if (existingContainer !== undefined) {
                        existingContainer[relativeAttrKeyPath as string] = mutatorValue;
                    } else {
                        output[itemKey] = {[relativeAttrKeyPath as string]: mutatorValue};
                    }
                } else {
                    // todo: add support for null relativeAttrKeyPath
                }
            }, {}
        );
    }

    async getMultipleAttrs<P extends string>(
        attrsKeyPaths: F.AutoPath<{ [recordKey: string]: T }, P>[]
    ): Promise<O.Optional<U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>>> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T, P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const retrievedValues: { [attrKeyPath: string]: any } = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: { [absoluteAttrKeyPath: string]: any }, relativeAttrsKeysPathsToRetrieve: F.AutoPath<T, P>[], itemKey: string) => {
                const matchingDataWrapper: ImmutableRecordWrapper<T> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const retrievedAttributes = matchingDataWrapper.getMultipleAttrs(relativeAttrsKeysPathsToRetrieve);
                    _.forEach(retrievedAttributes, (attrRetrievedValue: any, relativeAttrKeyPath: string) => {
                        const absoluteAttrKeyPath: string = `${itemKey}.${relativeAttrKeyPath}`;
                        result[absoluteAttrKeyPath] = attrRetrievedValue;
                    });
                }
            }, {}
        );
        return retrievedValues as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>;
    }

    abstract updateItemWithSubscribersPromise(
        itemKey: string, itemData: immutable.RecordOf<T>
    ): Promise<{oldValue: immutable.RecordOf<T> | null, subscribersPromise: Promise<any>}>;

    async updateItem(itemKey: string, itemData: immutable.RecordOf<T>): Promise<immutable.RecordOf<T> | null> {
        return (await this.updateItemWithSubscribersPromise(itemKey, itemData)).oldValue;
    }

    updateItemFromData() {

    }

    async updateAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>, value: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        // const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        if (relativeAttrKeyPath != null) {
            const dataWrapper: ImmutableRecordWrapper<T> | null = await this.getSingleRecordItem(itemKey);
            if (dataWrapper != null) {
                const oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined = dataWrapper.updateAttr(relativeAttrKeyPath, value);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
                return {oldValue, subscribersPromise};
            }
        } else {
            return await this.updateItemWithSubscribersPromise(itemKey, value as immutable.RecordOf<T>);
            /*const oldValue: O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>> | undefined = dataWrapper.updateRecord(value as any);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
            return {oldValue, subscribersPromise};*/
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async updateCachedRecordAttr<P extends string>(
        recordKey: string, attrKeyPath: F.AutoPath<T, P>, value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return await this.updateAttr<P>(`${recordKey}.${attrKeyPath}` as any, value as any);
    }

    async updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<{ [recordKey: string]: T }>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<{ [recordKey: string]: T }, M> | undefined, subscribersPromise: Promise<any> }> {
        const attrsRelativeMutatorsByItemsKeys: { [itemKey: string]: { [relativeAttrKeyPath: string]: any } } = (
            this.makeAttrsRelativeMutatorsByItemsKeys<M>(mutators)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeMutatorsByItemsKeys))
        );
        const collectedOldValues: { [attrKey: string]: any } = _.transform(attrsRelativeMutatorsByItemsKeys,
            (result: { [absoluteAttrKeyPath: string]: any }, relativeMutatorsToExecute: { [relativeAttrKeyPath: string]: any }, itemKey: string) => {
                const matchingDataWrapper: ImmutableRecordWrapper<T> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const oldValues: { [relativeAttrKeyPath: string]: any } = matchingDataWrapper.updateMultipleAttrs(relativeMutatorsToExecute);
                    _.forEach(oldValues, (attrOldValue: any, relativeAttrKeyPath: string) => {
                        const absoluteAttrKeyPath: string = `${itemKey}.${relativeAttrKeyPath}`;
                        result[absoluteAttrKeyPath] = attrOldValue;
                    });
                }
            }, {}
        );
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(Object.keys(mutators as { [attrKeyPath: string]: any }));
        return {oldValues: collectedOldValues as any, subscribersPromise};
    }

    async updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>, value: O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>
    ): Promise<{ oldValue: O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }> {
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = relativeAttrKeyPath == null ? this.props.itemModel : (
            navigateToAttrKeyPathIntoMapModelV2(this.props.itemModel, relativeAttrKeyPath as string)
        );
        if (matchingField != null) {
            const loadedValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> = matchingField.dataLoader(value);
            return await this.updateAttrWithReturnedSubscribersPromise<P>(attrKeyPath, loadedValue);
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async updateDataToMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutatorsWithoutImmutableCast<{ [recordKey: string]: T }>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<{ [recordKey: string]: T }, M> | undefined, subscribersPromise: Promise<any> }> {
        const loadedMutators: { [mutatorAttrKeyPath: string]: ImmutableCast<any> } = (
            _.transform(mutators, (output: { [mutatorAttrKeyPath: string]: ImmutableCast<any> }, mutatorValue: any, mutatorAttrKeyPath) => {
                const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(mutatorAttrKeyPath);
                const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null  = (
                    navigateToAttrKeyPathIntoMapModelV2(this.props.itemModel, relativeAttrKeyPath as string)
                );
                if (matchingField != null) {
                    output[mutatorAttrKeyPath] = matchingField.dataLoader(mutatorValue);
                }
            })
        );
        return await this.updateMultipleAttrsWithReturnedSubscribersPromise<M>(loadedMutators);
    }

    async deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                dataWrapper.deleteAttr(relativeAttrKeyPath);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
                return {subscribersPromise};
            } else {
                // todo: handle null relativeAttrKeyPath
            }
        }
        return {subscribersPromise: Promise.resolve(undefined)};
    }

    async deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<{ [recordKey: string]: T }, P>[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T, P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        _.forEach(attrsRelativeKeyPathsByItemsKeys, (relativeAttrsKeysPathsToDelete: F.AutoPath<T, P>[], itemKey: string) => {
            const matchingDataWrapper: ImmutableRecordWrapper<T> | null = dataWrappers[itemKey];
            if (matchingDataWrapper != null) {
                matchingDataWrapper.deleteMultipleAttrs(relativeAttrsKeysPathsToDelete);
            }
        });
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
        return {subscribersPromise};
    }

    async removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                const oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined = dataWrapper.removeAttr(relativeAttrKeyPath);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
                return {oldValue, subscribersPromise};
            } else {
                // todo: handle null relativeAttrKeyPath
            }
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<{ [recordKey: string]: T }, P>[]
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: F.AutoPath<T, P>[] } = (
            this.makeAttrsRelativeKeyPathsByItemsKeys(attrsKeyPaths)
        );
        const dataWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const collectedOldValues: { [removedAttrKeyPath: string]: any } = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: { [absoluteAttrKeyPath: string]: any }, relativeAttrsKeysPathsToRemove: F.AutoPath<T, P>[], itemKey: string) => {
                const matchingDataWrapper: ImmutableRecordWrapper<T> | null = dataWrappers[itemKey];
                if (matchingDataWrapper != null) {
                    const oldValues = matchingDataWrapper.removeMultipleAttrs(relativeAttrsKeysPathsToRemove);
                    _.forEach(oldValues, (attrOldValue: any, relativeAttrKeyPath: string) => {
                        const absoluteAttrKeyPath: string = `${itemKey}.${relativeAttrKeyPath}`;
                        result[absoluteAttrKeyPath] = attrOldValue;
                    });
                }
            }, {}
        );
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(attrsKeyPaths);
        return {removedValues: collectedOldValues as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>, subscribersPromise};
    }
}