import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../../DataProcessors";
import {BaseObjectStore, BaseObjectStoreProps} from "../BaseObjectStore";
import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../../../ModelsFields";
import SingleImmutableRecordWrapper from "../../../ImmutableRecordWrappers/SingleImmutableRecordWrapper";
import {
    ImmutableCast,
    ObjectFlattenedRecursiveMutatorsResults,
    ObjectOptionalFlattenedRecursiveMutators, ObjectOptionalFlattenedRecursiveMutatorsWithoutImmutableCast
} from "../../../types";
import {navigateToAttrKeyPathIntoMapModelV2} from "../../../utils/fieldsNavigation";
import {
    renderAttrKeyPathWithQueryKwargs,
    separateAttrKeyPath,
    separateAttrKeyPathWithQueryKwargs
} from "../../../utils/attrKeyPaths";
import {TypedAttrGetter, TypedFieldGetter, TypedImmutableSetterItem, TypedSetterItem} from "../../../models";


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
        const attrKeyPathParts: string[] = separateAttrKeyPath(attrKeyPath);
        const relativeAttrKeyPath: F.AutoPath<T, P> | null = (
            attrKeyPathParts.length > 1 ? attrKeyPathParts.slice(1).join('.') as F.AutoPath<T, P> : null
        );
        return {itemKey: attrKeyPathParts[0], relativeAttrKeyPath};
    }

    private makeRenderRelativeAttrKeyPath<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>, queryKwargs?: { [argKey: string]: any }
    ): {
        itemKey: string, renderedRelativeAttrKeyPath: F.AutoPath<T, P> | null
    } {
        const renderedAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(attrKeyPath);
        const renderedRelativeAttrKeyPath: F.AutoPath<T, P> | null = (
            renderedAttrKeyPathParts.length > 1 ? renderedAttrKeyPathParts.slice(1).join('.') as F.AutoPath<T, P> : null
        );
        return {itemKey: attrKeyPathParts[0], renderedRelativeAttrKeyPath};
    }


    protected async getMatchingDataWrapper<P extends string>(attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>): (
        Promise<{ dataWrapper: SingleImmutableRecordWrapper<T> | null, relativeAttrKeyPath: F.AutoPath<T, P> | null }>
    ) {
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        const dataWrapper: SingleImmutableRecordWrapper<T> | null = await this.getSingleRecordItem(itemKey);
        return {dataWrapper, relativeAttrKeyPath};
    }

    protected makeRecordDataWrapperFromItem(recordItem: immutable.RecordOf<T>): SingleImmutableRecordWrapper<T> {
        return new SingleImmutableRecordWrapper<T>(recordItem, this.props.itemModel);
    }

    protected makeRecordWrapperFromData(recordKey: string, recordData: T): SingleImmutableRecordWrapper<T> | null {
        const recordItem: immutable.RecordOf<T> | null = loadObjectDataToImmutableValuesWithFieldsModel<T>(recordData, this.props.itemModel);
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordItem) : null;
    }

    protected recordsDataToWrappers(data: { [recordKey: string]: T }): { [recordKey: string]: SingleImmutableRecordWrapper<T> } {
        return _.transform(data, (result: { [recordKey: string]: SingleImmutableRecordWrapper<T> | null }, recordData: T, recordKey: string) => {
                result[recordKey] = this.makeRecordWrapperFromData(recordKey, recordData)
            }, {}
        );
    }

    abstract loadFromData(data: { [recordKey: string]: T }): { subscribersPromise: Promise<any> };
    
    abstract getSingleRecordItem(key: string): Promise<SingleImmutableRecordWrapper<T> | null>;

    abstract getMultipleRecordItems(recordKeys: string[]): Promise<{ [recordKey: string]: SingleImmutableRecordWrapper<T> | null }>;

    async getAttr<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined> {
        const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        if (dataWrapper != null) {
            if (relativeAttrKeyPath != null) {
                return dataWrapper.getAttr(relativeAttrKeyPath, queryKwargs);
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
        getters: { [getterKey: string]: TypedFieldGetter<{ [recordKey: string]: T }, P> }
    // ): Promise<O.Optional<U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>>> {
    ): Promise<{ [getterKey: string]: ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>}> {
        type GetterItem = { renderedAttrKeyPathParts: string[] };
        const attrsRelativeGettersByItemsKeys: { [itemKey: string]: { [getterKey: string]: GetterItem } } = (
            _.transform(getters, (
                output: { [itemKey: string]: { [getterKey: string]: GetterItem } },
                getterItem: TypedFieldGetter<{ [recordKey: string]: T }, P>, getterKey: string
            ) => {
                const renderedAbsoluteAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(getterItem.attrKeyPath, getterItem.queryKwargs);
                gettersRenderedAbsoluteAttrKeyPathsParts.push(renderedAbsoluteAttrKeyPathParts);

                const itemKey: string = renderedAbsoluteAttrKeyPathParts[0];
                const renderedRelativeAttrKeyPathParts: string[] = renderedAbsoluteAttrKeyPathParts.slice(1);

                // todo: test support for empty renderedRelativeAttrKeyPathParts (does it update the entire record correctly ?)
                const newRelativeGetterItem: GetterItem = {
                    renderedAttrKeyPathParts: renderedRelativeAttrKeyPathParts,
                };

                const existingContainer: { [setterKey: string]: GetterItem } | undefined = output[itemKey];
                if (existingContainer !== undefined) {
                    existingContainer[getterKey] = newRelativeGetterItem;
                } else {
                    output[itemKey] = {[getterKey]: newRelativeGetterItem};
                }
            }, {}
        ));
        const recordsWrappersToRetrieveValuesFrom: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeGettersByItemsKeys))
        );
        const collectedRetrievedValues: { [setterKey: string]: any } = _.transform(attrsRelativeGettersByItemsKeys,
            (result: { [absoluteAttrKeyPath: string]: any }, relativeGettersToExecute: { [getterKey: string]: GetterItem }, itemKey: string) => {
                const matchingRecordWrapper: SingleImmutableRecordWrapper<T> | null = recordWrappersRequiringAlterations[itemKey];
                if (matchingRecordWrapper != null) {
                    const retrievedValues: { [getterKey: string]: any } = matchingRecordWrapper.getMultipleAttrs(relativeGettersToExecute);
                    _.assign(result, retrievedValues);
                }
            }, {}
        );
        return collectedRetrievedValues;
        // return retrievedValues;  // as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>;
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
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P> | string[], value: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        // const {dataWrapper, relativeAttrKeyPath} = await this.getMatchingDataWrapper<P>(attrKeyPath);
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        if (relativeAttrKeyPath != null) {
            const dataWrapper: SingleImmutableRecordWrapper<T> | null = await this.getSingleRecordItem(itemKey);
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

    async updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedSetterItem<{ [recordKey: string]: T }, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any } | undefined, subscribersPromise: Promise<any> }> {
        type SetterItem = { renderedAttrKeyPathParts: string[], valueToSet: any };
        // const renderedAttrKeyPathsToSetterKeys: { [renderedAttrKeyPath: string]: string } = {};
        const settersRenderedAbsoluteAttrKeyPathsParts: string[][] = [];
        const attrsRelativeSettersByItemsKeys: { [itemKey: string]: { [setterKey: string]: SetterItem } } = (
            _.transform(setters, (
                output: { [itemKey: string]: { [setterKey: string]: SetterItem } },
                setterItem: TypedSetterItem<{ [recordKey: string]: T }, P>, setterKey: string
            ) => {
                const renderedAbsoluteAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(setterItem.attrKeyPath, setterItem.queryKwargs);
                settersRenderedAbsoluteAttrKeyPathsParts.push(renderedAbsoluteAttrKeyPathParts);

                const itemKey: string = renderedAbsoluteAttrKeyPathParts[0];
                const renderedRelativeAttrKeyPathParts: string[] = renderedAbsoluteAttrKeyPathParts.slice(1);

                // todo: test support for empty renderedRelativeAttrKeyPathParts (does it update the entire record correctly ?)
                const newRelativeSetterItem: SetterItem = {
                    renderedAttrKeyPathParts: renderedRelativeAttrKeyPathParts,
                    valueToSet: setterItem.valueToSet
                };

                const existingContainer: { [setterKey: string]: SetterItem } | undefined = output[itemKey];
                if (existingContainer !== undefined) {
                    existingContainer[setterKey] = newRelativeSetterItem;
                } else {
                    output[itemKey] = {[setterKey]: newRelativeSetterItem};
                }
            }, {}
        ));
        const recordWrappersRequiringAlterations: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeSettersByItemsKeys))
        );
        const collectedOldValues: { [setterKey: string]: any } = _.transform(attrsRelativeSettersByItemsKeys,
            (result: { [absoluteAttrKeyPath: string]: any }, relativeSettersToExecute: { [setterKey: string]: SetterItem }, itemKey: string) => {
                const matchingRecordWrapper: SingleImmutableRecordWrapper<T> | null = recordWrappersRequiringAlterations[itemKey];
                if (matchingRecordWrapper != null) {
                    const oldValues: { [setterKey: string]: any } = matchingRecordWrapper.updateMultipleAttrs(relativeSettersToExecute);
                    _.assign(result, oldValues);
                }
            }, {}
        );
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(settersRenderedAbsoluteAttrKeyPathsParts);
        return {oldValues: collectedOldValues, subscribersPromise};
    }

    /*async updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<{ [recordKey: string]: T }>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<{ [recordKey: string]: T }, M> | undefined, subscribersPromise: Promise<any> }> {
        const attrsRelativeMutatorsByItemsKeys: { [itemKey: string]: { [relativeAttrKeyPath: string]: any } } = (
            this.makeAttrsRelativeMutatorsByItemsKeys<M>(mutators)
        );
        const dataWrappers: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeMutatorsByItemsKeys))
        );
        const collectedOldValues: { [attrKey: string]: any } = _.transform(attrsRelativeMutatorsByItemsKeys,
            (result: { [absoluteAttrKeyPath: string]: any }, relativeMutatorsToExecute: { [relativeAttrKeyPath: string]: any }, itemKey: string) => {
                const matchingDataWrapper: SingleImmutableRecordWrapper<T> | null = dataWrappers[itemKey];
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
    }*/

    async updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P> | TypedAttrGetter<{ [recordKey: string]: T }, P>,
        value: O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;
    async updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<{ [recordKey: string]: T }>>(
        attrKeyPath: P, value: O.Path<{ [recordKey: string]: T }, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> | undefined, subscribersPromise: Promise<any> }> {
        const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(attrKeyPath);
        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = relativeAttrKeyPath == null ? this.props.itemModel : (
            navigateToAttrKeyPathIntoMapModelV2(this.props.itemModel, relativeAttrKeyPath as string)
        );
        if (matchingField != null) {
            const loadedValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> = matchingField.dataLoader(value);
            return await this.updateAttrWithReturnedSubscribersPromise<P>(attrKeyPath, loadedValue);
        } else {
            console.error(`${attrKeyPath} was not a valid path`);
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedSetterItem<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {
        const loadedSetters: { [setterKey: string]: TypedImmutableSetterItem<T, P> } = (
            _.transform(setters, (
                output: { [setterKey: string]: TypedImmutableSetterItem<T, P> },
                setterItem: TypedSetterItem<T, P>, setterKey: string
            ) => {
                const {itemKey, relativeAttrKeyPath} = this.makeRelativeAttrKeyPath(setterKey);
                const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null  = (
                    navigateToAttrKeyPathIntoMapModelV2(this.props.itemModel, relativeAttrKeyPath as string)
                );
                if (matchingField != null) {
                    const loadedValue: ImmutableCast<O.Path<T, P>> = matchingField.dataLoader(setterItem.attrKeyPath);
                    output[setterKey] = {
                        attrKeyPath: setterItem.attrKeyPath,
                        queryKwargs: setterItem.queryKwargs,
                        valueToSet: loadedValue
                    };
                } else {
                    console.error(`${mutatorAttrKeyPath} was not a valid path`);
                }
            }, {})
        );
        return await this.updateMultipleAttrsWithReturnedSubscribersPromise<P>(loadedSetters);
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
        const dataWrappers: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        _.forEach(attrsRelativeKeyPathsByItemsKeys, (relativeAttrsKeysPathsToDelete: F.AutoPath<T, P>[], itemKey: string) => {
            const matchingDataWrapper: SingleImmutableRecordWrapper<T> | null = dataWrappers[itemKey];
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
        const dataWrappers: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const collectedOldValues: { [removedAttrKeyPath: string]: any } = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: { [absoluteAttrKeyPath: string]: any }, relativeAttrsKeysPathsToRemove: F.AutoPath<T, P>[], itemKey: string) => {
                const matchingDataWrapper: SingleImmutableRecordWrapper<T> | null = dataWrappers[itemKey];
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