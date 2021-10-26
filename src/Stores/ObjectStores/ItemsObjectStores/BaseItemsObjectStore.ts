import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../../DataProcessors";
import {BaseObjectStore, BaseObjectStoreProps} from "../BaseObjectStore";
import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../../../ModelsFields";
import SingleImmutableRecordWrapper from "../../../ImmutableRecordWrappers/SingleImmutableRecordWrapper";
import {
    ImmutableCast,
    ObjectOptionalFlattenedRecursiveMutators
} from "../../../types";
import {navigateToAttrKeyPathIntoMapModelV2} from "../../../utils/fieldsNavigation";
import {
    separateAttrKeyPath,
    separateAttrKeyPathWithQueryKwargs
} from "../../../utils/attrKeyPaths";
import {
    TypedAttrGetter,
    TypedImmutableAttrSetter,
    TypedAttrSetter,
    TypedAttrRemover,
    TypedAttrSelector
} from "../../../models";


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

    protected async getMatchingDataWrapper<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>, queryKwargs: { [argKey: string]: any }
    ): Promise<{ recordWrapper: SingleImmutableRecordWrapper<T> | null, renderedRelativeAttrKeyPathParts: F.AutoPath<T, P> | null }> {
        const renderedAbsoluteAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        const recordWrapper: SingleImmutableRecordWrapper<T> | null = await this.getSingleRecordItem(renderedAbsoluteAttrKeyPathParts[0]);
        return {recordWrapper, renderedRelativeAttrKeyPathParts: renderedAbsoluteAttrKeyPathParts.slice(1)};
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
        const {recordWrapper, renderedRelativeAttrKeyPathParts} = await this.getMatchingDataWrapper<P>(attrKeyPath, queryKwargs);
        return recordWrapper != null ? recordWrapper.getAttr(renderedRelativeAttrKeyPathParts) : undefined;
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

    private makeAttrsSelectorsByItemsKeys<SelectorItem extends TypedAttrSelector<any, any>>(
        selectors: { [selectorKey: string]: SelectorItem }
    ): { [itemKey: string]: { [selectorKey: string]: string[] }} {
        return _.transform(selectors, (
            output: { [itemKey: string]: { [selectorKey: string]: string[] } },
            selectorItem: SelectorItem, selectorKey: string
        ) => {
            const renderedAbsoluteAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(selectorItem.attrKeyPath, selectorItem.queryKwargs);
            const itemKey: string = renderedAbsoluteAttrKeyPathParts[0];
            const renderedRelativeAttrKeyPathParts: string[] = renderedAbsoluteAttrKeyPathParts.slice(1);
            // todo: test support for empty renderedRelativeAttrKeyPathParts (does it update the entire record correctly ?)

            const existingContainer: { [selectorKey: string]: string[] } | undefined = output[itemKey];
            if (existingContainer !== undefined) {
                existingContainer[selectorKey] = renderedRelativeAttrKeyPathParts;
            } else {
                output[itemKey] = {[selectorKey]: renderedRelativeAttrKeyPathParts};
            }
        }, {});
    }

    private makeAttrsSelectorsByItemsKeysARRAY<SelectorItem extends TypedAttrSelector<any, any>>(
        selectors: SelectorItem[]
    ): { [itemKey: string]: string[][] } {
        return _.transform(selectors, (
            output: { [itemKey: string]: string[][] },
            selectorItem: SelectorItem
        ) => {
            const renderedAbsoluteAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(selectorItem.attrKeyPath, selectorItem.queryKwargs);
            const itemKey: string = renderedAbsoluteAttrKeyPathParts[0];
            const renderedRelativeAttrKeyPathParts: string[] = renderedAbsoluteAttrKeyPathParts.slice(1);
            // todo: test support for empty renderedRelativeAttrKeyPathParts (does it update the entire record correctly ?)

            const existingContainer: string[][] | undefined = output[itemKey];
            if (existingContainer !== undefined) {
                existingContainer.push(renderedRelativeAttrKeyPathParts);
            } else {
                output[itemKey] = [renderedRelativeAttrKeyPathParts];
            }
        }, {});
    }

    async getMultipleAttrs<P extends string>(
        getters: { [getterKey: string]: TypedAttrGetter<{ [recordKey: string]: T }, P> }
    // ): Promise<O.Optional<U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>>> {
    ): Promise<{ [getterKey: string]: ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>}> {
        const attrsRelativeGettersByItemsKeys: { [itemKey: string]: { [getterKey: string]: string[] } } = (
            this.makeAttrsSelectorsByItemsKeys<TypedAttrGetter<{ [recordKey: string]: T }, P>>(getters)
        );
        const recordsWrappersToRetrieveValuesFrom: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeGettersByItemsKeys))
        );
        const collectedRetrievedValues: { [getterKey: string]: any } = _.transform(attrsRelativeGettersByItemsKeys,
            (result: { [getterKey: string]: any }, relativeGettersToExecute: { [getterKey: string]: string[] }, itemKey: string) => {
                const matchingRecordWrapper: SingleImmutableRecordWrapper<T> | null = recordsWrappersToRetrieveValuesFrom[itemKey];
                if (matchingRecordWrapper != null) {
                    const retrievedValues: { [getterKey: string]: any | undefined } = (
                        matchingRecordWrapper.getMultipleAttrs(relativeGettersToExecute)
                    );
                    _.assign(result, retrievedValues);
                }
            }, {}
        );
        return collectedRetrievedValues;
        // return retrievedValues;  // as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>;
    }

    async updateAttrWithReturnedSubscribersPromise<P extends string>(
        // attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P> | string[], value: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>>
        { attrKeyPath, queryKwargs, valueToSet }: TypedImmutableAttrSetter<{ [recordKey: string]: T}, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const {recordWrapper, renderedRelativeAttrKeyPathParts} = await this.getMatchingDataWrapper<P>(attrKeyPath, queryKwargs);
        if (recordWrapper != null) {
            const oldValue: any | undefined = recordWrapper.updateAttr(renderedRelativeAttrKeyPathParts, valueToSet);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedRelativeAttrKeyPathParts);
            return {oldValue: oldValue as ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>>, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async updateCachedRecordAttr<P extends string>(
        recordKey: string, attrKeyPath: F.AutoPath<T, P>, value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return await this.updateAttr<P>(`${recordKey}.${attrKeyPath}` as any, value as any);
    }

    async updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<{ [recordKey: string]: T }, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any } | undefined, subscribersPromise: Promise<any> }> {
        type SetterItem = { renderedAttrKeyPathParts: string[], valueToSet: any };

        const settersRenderedAbsoluteAttrKeyPathsParts: string[][] = [];
        const attrsRelativeSettersByItemsKeys: { [itemKey: string]: { [setterKey: string]: SetterItem } } = (
            _.transform(setters, (
                output: { [itemKey: string]: { [setterKey: string]: SetterItem } },
                setterItem: TypedAttrSetter<{ [recordKey: string]: T }, P>, setterKey: string
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
                    const oldValues: { [setterKey: string]: any | undefined } = (
                        matchingRecordWrapper.updateMultipleAttrs(relativeSettersToExecute)
                    );
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
        { attrKeyPath, queryKwargs, valueToSet }: TypedImmutableAttrSetter<{ [recordKey: string]: T }, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
    /*async updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<{ [recordKey: string]: T }>>(
        attrKeyPath: P, value: O.Path<{ [recordKey: string]: T }, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> | undefined, subscribersPromise: Promise<any> }> {*/
        const renderedAbsoluteAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        const renderedRelativeAttrKeyPathParts: string[] = renderedAbsoluteAttrKeyPathParts.slice(1);
        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = (
            navigateToAttrKeyPathIntoMapModelV2(this.props.itemModel, renderedRelativeAttrKeyPathParts)
        );
        if (matchingField != null) {
            const loadedValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> = matchingField.dataLoader(valueToSet);
            return await this.updateAttrWithReturnedSubscribersPromise<P>(
                {attrKeyPath, queryKwargs, valueToSet: loadedValue}
            );
        } else {
            console.error(`${attrKeyPath} was not a valid path`);
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {
        const loadedSetters: { [setterKey: string]: TypedImmutableAttrSetter<T, P> } = (
            _.transform(setters, (
                output: { [setterKey: string]: TypedImmutableAttrSetter<T, P> },
                setterItem: TypedAttrSetter<T, P>, setterKey: string
            ) => {
                const renderedAbsoluteAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(setterItem.attrKeyPath, setterItem.queryKwargs);
                const renderedRelativeAttrKeyPathParts: string[] = renderedAbsoluteAttrKeyPathParts.slice(1);
                const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = (
                    navigateToAttrKeyPathIntoMapModelV2(this.props.itemModel, renderedRelativeAttrKeyPathParts)
                );
                if (matchingField != null) {
                    const loadedValue: ImmutableCast<O.Path<T, P>> = matchingField.dataLoader(setterItem.valueToSet);
                    output[setterKey] = {
                        attrKeyPath: setterItem.attrKeyPath,
                        queryKwargs: setterItem.queryKwargs,
                        valueToSet: loadedValue
                    };
                } else {
                    console.error(`${relativeAttrKeyPath} was not a valid path`);
                }
            }, {})
        );
        return await this.updateMultipleAttrsWithReturnedSubscribersPromise<P>(loadedSetters);
    }

    async deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const {recordWrapper, renderedRelativeAttrKeyPathParts} = await this.getMatchingDataWrapper<P>(attrKeyPath, queryKwargs);
        if (recordWrapper != null) {
            recordWrapper.deleteAttr(renderedRelativeAttrKeyPathParts);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedRelativeAttrKeyPathParts);
            return {subscribersPromise};
        }
        return {subscribersPromise: Promise.resolve(undefined)};
    }

    async deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removers: TypedAttrRemover<{ [recordKey: string]: T }, P>[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const attrsRelativeRemoversByItemsKeys: { [itemKey: string]: string[][] } = (
            this.makeAttrsSelectorsByItemsKeysARRAY<TypedAttrRemover<{ [recordKey: string]: T }, P>>(removers)
        );
        const recordWrappers: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeRemoversByItemsKeys))
        );
        const absoluteAlteredAttrsKeyPathParts: string[][] = [];
        _.forEach(attrsRelativeRemoversByItemsKeys, (relativeRemoversToExecute: string[][], itemKey: string) => {
            const matchingRecordWrapper: SingleImmutableRecordWrapper<T> | null = recordWrappers[itemKey];
            if (matchingRecordWrapper != null) {
                matchingRecordWrapper.deleteMultipleAttrs(relativeRemoversToExecute);
            }
            _.forEach(relativeRemoversToExecute, (rar: string[]) => {
                absoluteAlteredAttrsKeyPathParts.push([itemKey, ...rar]);
            });
        });
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(absoluteAlteredAttrsKeyPathParts);
        return {subscribersPromise};
    }

    async removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const {recordWrapper, renderedRelativeAttrKeyPathParts} = await this.getMatchingDataWrapper<P>(attrKeyPath, queryKwargs);
        if (recordWrapper != null) {
            const oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined = (
                recordWrapper.removeAttr(renderedRelativeAttrKeyPathParts)
            );
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedRelativeAttrKeyPathParts);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removers: { [removerKey: string]: TypedAttrRemover<{ [recordKey: string]: T }, P> }
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }> {
        const attrsRelativeKeyPathsByItemsKeys: { [itemKey: string]: { [removerKey: string]: string[] } } = (
            this.makeAttrsSelectorsByItemsKeys<TypedAttrRemover<{ [recordKey: string]: T }>>(removers)
        );
        const recordWrappers: { [itemKey: string]: SingleImmutableRecordWrapper<T> | null } = await (
            this.getMultipleRecordItems(Object.keys(attrsRelativeKeyPathsByItemsKeys))
        );
        const alteredAbsoluteRelativeAttrKeyPaths: string[][] = [];
        const collectedOldValues: { [removerKey: string]: any } = _.transform(attrsRelativeKeyPathsByItemsKeys,
            (result: { [removerKey: string]: any }, relativeAttrsKeysPathsToRemove: { [removerKey: string]: string[] }, itemKey: string) => {
                const matchingRecordWrapper: SingleImmutableRecordWrapper<T> | null = recordWrappers[itemKey];
                if (matchingRecordWrapper != null) {
                    const oldValues: { [removerKey: string]: any | undefined } = (
                        matchingRecordWrapper.removeMultipleAttrs(relativeAttrsKeysPathsToRemove)
                    );
                    _.assign(result, oldValues);
                    _.forEach(relativeAttrsKeysPathsToRemove, (rar1: string[]) => {
                        alteredAbsoluteRelativeAttrKeyPaths.push([itemKey, ...rar1]);
                    });
                }
            }, {}
        );
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(alteredAbsoluteRelativeAttrKeyPaths);
        return {removedValues: collectedOldValues as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>, subscribersPromise};
    }
}