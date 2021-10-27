import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../../DataProcessors";
import {BaseObjectStore, BaseObjectStoreProps} from "../BaseObjectStore";
import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../../../ModelsFields";
import ImmutableRecordWrapper from "../../../ImmutableRecordWrapper";
import {ImmutableCast, ObjectOptionalFlattenedRecursiveMutators} from "../../../types";
import {
    navigateToAttrKeyPathPartsIntoMapModel
} from "../../../utils/fieldsNavigation";
import {renderAttrKeyPathWithQueryKwargs} from "../../../utils/attrKeyPaths";
import {TypedAttrRemover, TypedAttrSelector, TypedAttrSetter, TypedImmutableAttrSetter} from "../../../models";
import {RenderedTypedAttrSetter, RenderedTypedImmutableAttrSetter} from "../../../internalModels";


export interface BaseItemsObjectStoreProps extends BaseObjectStoreProps {
    itemModel: MapModel;
}

export abstract class BaseItemsObjectStore<T extends { [p: string]: any }> extends BaseObjectStore<{ [recordKey: string]: T }> {
    protected constructor(public readonly props: BaseItemsObjectStoreProps) {
        super(props);
    }

    private static separateAbsoluteRenderedAttrKeyPathPartsToRelative(
        absoluteRenderedAttrKeyPathParts: string[]
    ): { itemKey: string, renderedRelativeAttrKeyPathParts: string[] } {
        return {itemKey: absoluteRenderedAttrKeyPathParts[0], renderedRelativeAttrKeyPathParts: absoluteRenderedAttrKeyPathParts.slice(1)};
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

    protected async _getAttr<P extends string>(
        renderedAbsoluteAttrKeyPathParts: string[]
    ): Promise<ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined> {
        const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(renderedAbsoluteAttrKeyPathParts);
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getSingleRecordItem<P>(itemKey);
        return recordWrapper != null ? recordWrapper.getAttr(renderedRelativeAttrKeyPathParts) : undefined;
    }

    async getRecordItem(recordKey: string): Promise<immutable.RecordOf<T> | undefined> {
        // todo: deprecate
        return await this.getAttr(recordKey) as immutable.RecordOf<T>;
    }

    private makeAttrsSelectorsByItemsKeys<SelectorItem extends TypedAttrSelector<any, any>>(
        selectors: { [selectorKey: string]: SelectorItem }
    ): { [itemKey: string]: { [selectorKey: string]: string[] }} {
        return _.transform(selectors, (
            output: { [itemKey: string]: { [selectorKey: string]: string[] } },
            selectorItem: SelectorItem, selectorKey: string
        ) => {
            const renderedAbsoluteAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(selectorItem.attrKeyPath, selectorItem.queryKwargs);
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
            const renderedAbsoluteAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(selectorItem.attrKeyPath, selectorItem.queryKwargs);
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

    protected async _getMultipleAttrs<P extends string>(
        getters: { [getterKey: string]: string[] }
    // ): Promise<O.Optional<U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>>> {
    ): Promise<{ [getterKey: string]: ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>}> {
        const uniquesItemsKeys: string[] = _.uniq(_.map(getters, (getterRenderedAttrKeyPathParts: string[]) => getterRenderedAttrKeyPathParts[0]));
        const recordsWrappersToRetrieveValuesFrom: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordItems(uniquesItemsKeys);
        const collectedRetrievedValues: { [getterKey: string]: any } = _.transform(getters,
            (result: { [getterKey: string]: any | undefined }, getterAbsoluteRenderedAttrKeyPathParts: string[], getterKey: string) => {
                const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore
                    .separateAbsoluteRenderedAttrKeyPathPartsToRelative(getterAbsoluteRenderedAttrKeyPathParts);

                const matchingRecordWrapper: ImmutableRecordWrapper<T> | null = recordsWrappersToRetrieveValuesFrom[itemKey];
                if (matchingRecordWrapper != null) {
                    result[getterKey] = matchingRecordWrapper.getAttr(renderedRelativeAttrKeyPathParts);
                }
            }, {}
        );
        return collectedRetrievedValues;
        // return retrievedValues;  // as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>;
    }

    protected async _updateAttrWithReturnedSubscribersPromise<P extends string>(
        // attrKeyPath: F.AutoPath<{ [recordKey: string]: T }, P> | string[], value: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>>
        renderedAbsoluteAttrKeyPathParts: string[], valueToSet: ImmutableCast<F.AutoPath<T, P>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(renderedAbsoluteAttrKeyPathParts);
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getSingleRecordItem(itemKey);
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

    protected async _updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: RenderedTypedImmutableAttrSetter<{ [recordKey: string]: T }, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {

        const settersRenderedAbsoluteAttrKeyPathsParts: string[][] = [];
        const uniquesItemsKeys: string[] = _.uniq(_.map(setters, (setterItem: RenderedTypedImmutableAttrSetter<{ [recordKey: string]: T }, P>) => {
            settersRenderedAbsoluteAttrKeyPathsParts.push(setterItem.renderedAttrKeyPathParts);
            return setterItem.renderedAttrKeyPathParts[0];
        }));

        const recordWrappersRequiringAlterations: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordItems(uniquesItemsKeys);
        const oldValues: { [setterKey: string]: any | undefined } = _.mapValues(setters, (setterItem: RenderedTypedImmutableAttrSetter<{ [recordKey: string]: T }, P>) => {
            const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(setterItem.renderedAttrKeyPathParts);
            const matchingRecordWrapper: ImmutableRecordWrapper<T> | null = recordWrappersRequiringAlterations[itemKey];
            return matchingRecordWrapper != null ? matchingRecordWrapper.updateAttr(renderedRelativeAttrKeyPathParts, setterItem.valueToSet) : undefined;
        });
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(settersRenderedAbsoluteAttrKeyPathsParts);
        return {oldValues, subscribersPromise};
    }

    async _updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAbsoluteAttrKeyPathParts: string[], valueToSet: F.AutoPath<{ [recordKey: string]: T }, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
    /*async updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<{ [recordKey: string]: T }>>(
        attrKeyPath: P, value: O.Path<{ [recordKey: string]: T }, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> | undefined, subscribersPromise: Promise<any> }> {*/
        const renderedRelativeAttrKeyPathParts: string[] = renderedAbsoluteAttrKeyPathParts.slice(1);
        const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = (
            navigateToAttrKeyPathPartsIntoMapModel(this.props.itemModel, renderedRelativeAttrKeyPathParts)
        );
        if (matchingField != null) {
            const loadedValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, P>> = matchingField.dataLoader(valueToSet);
            return await this._updateAttrWithReturnedSubscribersPromise<P>(renderedAbsoluteAttrKeyPathParts, loadedValue);
        } else {
            console.error(`${renderedRelativeAttrKeyPathParts} was not a valid path`);
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    async _updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: RenderedTypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {
        // We use a transform instead of a mapValues, because we do not want to add setters for attributes with invalid attr path.
        const loadedSetters: { [setterKey: string]: RenderedTypedImmutableAttrSetter<T, P> } = _.transform(setters,
            (output: { [setterKey: string]: RenderedTypedImmutableAttrSetter<T, P> }, setterItem: RenderedTypedAttrSetter<T, P>, setterKey: string) => {
                const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore
                    .separateAbsoluteRenderedAttrKeyPathPartsToRelative(setterItem.renderedAttrKeyPathParts);

                const matchingField: BasicFieldModel | TypedDictFieldModel | MapModel | null = (
                    navigateToAttrKeyPathPartsIntoMapModel(this.props.itemModel, renderedRelativeAttrKeyPathParts)
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
        renderedAbsoluteAttrKeyPathParts: string[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(renderedAbsoluteAttrKeyPathParts);
        const recordWrapper: ImmutableRecordWrapper<{ [recordKey: string]: T }> | null = await this.getSingleRecordItem(itemKey);
        if (recordWrapper != null) {
            recordWrapper.deleteAttr(renderedRelativeAttrKeyPathParts);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAbsoluteAttrKeyPathParts);
            return {subscribersPromise};
        }
        return {subscribersPromise: Promise.resolve(undefined)};
    }

    async _deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removersRenderedAbsoluteAttrsKeyPathsParts: string[][]
    ): Promise<{ subscribersPromise: Promise<any> }> {

        const uniquesItemsKeys: string[] = _.uniq(_.map(removersRenderedAbsoluteAttrsKeyPathsParts,
            (removerRenderedAttrKeyPathParts: string[]) => removerRenderedAttrKeyPathParts[0]
        ));
        const recordWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordItems(uniquesItemsKeys);

        const absoluteAlteredAttrsKeyPathParts: string[][] = [];
        _.forEach(removersRenderedAbsoluteAttrsKeyPathsParts, (removerRenderedAbsoluteAttrKeyPathParts: string[]) => {
            const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore
                .separateAbsoluteRenderedAttrKeyPathPartsToRelative(removerRenderedAbsoluteAttrKeyPathParts);

            const matchingRecordWrapper: ImmutableRecordWrapper<T> | null = recordWrappers[itemKey];
            if (matchingRecordWrapper != null) {
                matchingRecordWrapper.deleteAttr(renderedRelativeAttrKeyPathParts);
                absoluteAlteredAttrsKeyPathParts.push(removerRenderedAbsoluteAttrKeyPathParts);
            }
            // If the matchingRecordWrapper is null, we do not push to absoluteAlteredAttrsKeyPathParts,
            // to avoid triggering listener of non altered attributes.
        });
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(absoluteAlteredAttrsKeyPathParts);
        return {subscribersPromise};
    }

    protected async _removeAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAbsoluteAttrKeyPathParts: string[]
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(renderedAbsoluteAttrKeyPathParts);
        const recordWrapper: ImmutableRecordWrapper<{ [recordKey: string]: T }> | null = await this.getSingleRecordItem(itemKey);
        if (recordWrapper != null) {
            const oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined = (
                recordWrapper.removeAttr(renderedRelativeAttrKeyPathParts)
            );
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAbsoluteAttrKeyPathParts);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    protected async _removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        renderedRemovers: { [removerKey: string]: string[] }
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }> {

        const uniquesItemsKeys: string[] = _.uniq(_.map(renderedRemovers, (removerRenderedAttrKeyPathParts: string[]) => removerRenderedAttrKeyPathParts[0]));
        const recordWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordItems(uniquesItemsKeys);

        const alteredAbsoluteRelativeAttrKeyPaths: string[][] = [];
        const removedValues: { [removerKey: string]: any } = _.mapValues(renderedRemovers, (removerRenderedAbsoluteAttrKeyPathParts: string[]) => {
            const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(removerRenderedAbsoluteAttrKeyPathParts);
            const matchingRecordWrapper: ImmutableRecordWrapper<T> | null = recordWrappers[itemKey];
            if (matchingRecordWrapper != null) {
                alteredAbsoluteRelativeAttrKeyPaths.push(removerRenderedAbsoluteAttrKeyPathParts);
                return matchingRecordWrapper.removeAttr(renderedRelativeAttrKeyPathParts);
            }
            return undefined;
        });
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(alteredAbsoluteRelativeAttrKeyPaths);
        return {removedValues: removedValues as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>, subscribersPromise};
    }
}