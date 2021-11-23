import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../../../DataProcessors";
import {BaseObjectStore, BaseObjectStoreProps} from "../BaseObjectStore";
import {BasicFieldModel, MapModel, TypedDictFieldModel} from "../../../ModelsFields";
import ImmutableRecordWrapper from "../../../ImmutableRecordWrapper";
import {ImmutableCast} from "../../../types";
import {navigateToAttrKeyPathPartsIntoMapModel} from "../../../utils/fieldsNavigation";
import {renderAttrKeyPathWithQueryKwargs} from "../../../utils/attrKeyPaths";
import {TypedAttrSelector} from "../../../models";
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

    protected makeRecordDataWrapperFromItem(recordItem: ImmutableCast<T>): ImmutableRecordWrapper<T> {
        return new ImmutableRecordWrapper<T>(recordItem, this.props.itemModel);
    }

    protected makeRecordWrapperFromData(recordKey: string, recordData: T): ImmutableRecordWrapper<T> | null {
        const recordItem: ImmutableCast<T> | null = loadObjectDataToImmutableValuesWithFieldsModel<T>(recordData, this.props.itemModel);
        return recordItem != null ? this.makeRecordDataWrapperFromItem(recordItem) : null;
    }

    protected recordsDataToWrappers(data: { [recordKey: string]: T }): { [recordKey: string]: ImmutableRecordWrapper<T> } {
        return _.transform(data, (result: { [recordKey: string]: ImmutableRecordWrapper<T> | null }, recordData: T, recordKey: string) => {
                result[recordKey] = this.makeRecordWrapperFromData(recordKey, recordData)
            }, {}
        );
    }

    protected abstract getSingleRecordWrapper(key: string): Promise<ImmutableRecordWrapper<T> | null>;
    
    async getSingleRecord(key: string): Promise<ImmutableCast<T> | null> {
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getSingleRecordWrapper(key);
        return recordWrapper != null ? recordWrapper.RECORD_DATA as ImmutableCast<T> : null;
    }

    protected abstract getMultipleRecordsWrappers(recordKeys: string[]): Promise<{ [recordKey: string]: ImmutableRecordWrapper<T> | null }>;

    async getMultipleRecords(recordKeys: string[]): Promise<{ [recordKey: string]: ImmutableCast<T> | null }> {
        const recordsWrappers: { [recordKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordsWrappers(recordKeys);
        return _.mapValues(recordsWrappers, (recordWrapper: ImmutableRecordWrapper<T> | null) => {
            return recordWrapper != null ? recordWrapper.RECORD_DATA as ImmutableCast<T> : null;
        });
    }

    /** Update record wrapper data, or remove it if value is null. */
    protected abstract updateSingleRecordWrapper(recordKey: string, value: ImmutableCast<T> | null): Promise<ImmutableRecordWrapper<T> | null>;

    protected async _updateSingleRecord(recordKey: string, value: ImmutableCast<T> | null): Promise<ImmutableCast<T> | null> {
        const oldRecordWrapper: ImmutableRecordWrapper<T> | null = await this.updateSingleRecordWrapper(recordKey, value);
        return oldRecordWrapper != null ? oldRecordWrapper.RECORD_DATA : null;
    }

    protected async _getAttr<P extends string>(
        renderedAbsoluteAttrKeyPathParts: string[]
    ): Promise<ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined> {
        const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(renderedAbsoluteAttrKeyPathParts);
        const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getSingleRecordWrapper<P>(itemKey);
        return recordWrapper != null ? recordWrapper.getAttr(renderedRelativeAttrKeyPathParts) : undefined;
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
        const recordsWrappersToRetrieveValuesFrom: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordsWrappers(uniquesItemsKeys);
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
        if (renderedRelativeAttrKeyPathParts.length > 0) {
            const recordWrapper: ImmutableRecordWrapper<T> | null = await this.getSingleRecordWrapper(itemKey);
            if (recordWrapper != null) {
                const oldValue: any | undefined = recordWrapper.updateAttr(renderedRelativeAttrKeyPathParts, valueToSet);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedRelativeAttrKeyPathParts);
                return {oldValue: oldValue as ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>>, subscribersPromise};
            }
        } else {
            const oldValue: any | undefined = await this._updateSingleRecord(itemKey, valueToSet);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedRelativeAttrKeyPathParts);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    protected async _updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: RenderedTypedImmutableAttrSetter<{ [recordKey: string]: T }, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {

        const settersRenderedAbsoluteAttrKeyPathsParts: string[][] = [];
        const uniquesItemsKeys: string[] = _.uniq(_.map(setters, (setterItem: RenderedTypedImmutableAttrSetter<{ [recordKey: string]: T }, P>) => {
            settersRenderedAbsoluteAttrKeyPathsParts.push(setterItem.renderedAttrKeyPathParts);
            return setterItem.renderedAttrKeyPathParts[0];
        }));

        const recordWrappersRequiringAlterations: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordsWrappers(uniquesItemsKeys);
        const oldValues: { [setterKey: string]: any | undefined } = {};
        await Promise.all(_.map(setters, async (setterItem: RenderedTypedImmutableAttrSetter<{ [recordKey: string]: T }, P>, setterKey: string) => {
            const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore
                .separateAbsoluteRenderedAttrKeyPathPartsToRelative(setterItem.renderedAttrKeyPathParts);

            oldValues[setterKey] = await (async () => {
                if (renderedRelativeAttrKeyPathParts.length > 0) {
                    const matchingRecordWrapper: ImmutableRecordWrapper<T> | null = recordWrappersRequiringAlterations[itemKey];
                    return matchingRecordWrapper != null ? matchingRecordWrapper.updateAttr(renderedRelativeAttrKeyPathParts, setterItem.valueToSet) : undefined;
                } else {
                    return await this._updateSingleRecord(itemKey, setterItem.valueToSet);
                }
            })();
        }));
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(settersRenderedAbsoluteAttrKeyPathsParts);
        return {oldValues, subscribersPromise};
    }

    protected async _updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
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

    protected async _updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
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

    protected async _deleteAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAbsoluteAttrKeyPathParts: string[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore.separateAbsoluteRenderedAttrKeyPathPartsToRelative(renderedAbsoluteAttrKeyPathParts);
        if (renderedRelativeAttrKeyPathParts.length > 0) {
            const recordWrapper: ImmutableRecordWrapper<{ [recordKey: string]: T }> | null = await this.getSingleRecordWrapper(itemKey);
            if (recordWrapper != null) {
                recordWrapper.deleteAttr(renderedRelativeAttrKeyPathParts);
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAbsoluteAttrKeyPathParts);
                return {subscribersPromise};
            }
        } else {
            await this.updateSingleRecordWrapper(itemKey, undefined);
        }
        return {subscribersPromise: Promise.resolve(undefined)};
    }

    protected async _deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removersRenderedAbsoluteAttrsKeyPathsParts: string[][]
    ): Promise<{ subscribersPromise: Promise<any> }> {

        const uniquesItemsKeys: string[] = _.uniq(_.map(removersRenderedAbsoluteAttrsKeyPathsParts,
            (removerRenderedAttrKeyPathParts: string[]) => removerRenderedAttrKeyPathParts[0]
        ));
        const recordWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordsWrappers(uniquesItemsKeys);

        const absoluteAlteredAttrsKeyPathParts: string[][] = [];
        await Promise.all(_.map(removersRenderedAbsoluteAttrsKeyPathsParts, async (removerRenderedAbsoluteAttrKeyPathParts: string[]) => {
            const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore
                .separateAbsoluteRenderedAttrKeyPathPartsToRelative(removerRenderedAbsoluteAttrKeyPathParts);

            if (renderedRelativeAttrKeyPathParts.length > 0) {
                const matchingRecordWrapper: ImmutableRecordWrapper<T> | null = recordWrappers[itemKey];
                if (matchingRecordWrapper != null) {
                    matchingRecordWrapper.deleteAttr(renderedRelativeAttrKeyPathParts);
                    absoluteAlteredAttrsKeyPathParts.push(removerRenderedAbsoluteAttrKeyPathParts);
                }
                // If the matchingRecordWrapper is null, we do not push to absoluteAlteredAttrsKeyPathParts,
                // to avoid triggering listener of non altered attributes.
            } else {
                await this.updateSingleRecordWrapper(itemKey, undefined);
            }
        }));
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(absoluteAlteredAttrsKeyPathParts);
        return {subscribersPromise};
    }

    protected async _removeAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAbsoluteAttrKeyPathParts: string[]
    ): Promise<{ oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore
            .separateAbsoluteRenderedAttrKeyPathPartsToRelative(renderedAbsoluteAttrKeyPathParts);

        if (renderedRelativeAttrKeyPathParts.length > 0) {
            const recordWrapper: ImmutableRecordWrapper<{ [recordKey: string]: T }> | null = await this.getSingleRecordWrapper(itemKey);
            if (recordWrapper != null) {
                const oldValue: ImmutableCast<O.Path<{ [recordKey: string]: T }, S.Split<P, '.'>>> | undefined = (
                    recordWrapper.removeAttr(renderedRelativeAttrKeyPathParts)
                );
                const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAbsoluteAttrKeyPathParts);
                return {oldValue, subscribersPromise};
            }
        } else {
            const oldValue: ImmutableCast<T> | undefined = await this._updateSingleRecord(itemKey, undefined);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForAttr(renderedAbsoluteAttrKeyPathParts);
            return {oldValue, subscribersPromise};
        }
        return {oldValue: undefined, subscribersPromise: Promise.resolve(undefined)};
    }

    protected async _removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        renderedRemovers: { [removerKey: string]: string[] }
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }> {

        const uniquesItemsKeys: string[] = _.uniq(_.map(renderedRemovers, (removerRenderedAttrKeyPathParts: string[]) => removerRenderedAttrKeyPathParts[0]));
        const recordWrappers: { [itemKey: string]: ImmutableRecordWrapper<T> | null } = await this.getMultipleRecordsWrappers(uniquesItemsKeys);

        const alteredAbsoluteRelativeAttrKeyPaths: string[][] = [];
        const removedValues: { [removerKey: string]: any } = {};
        await Promise.all(_.map(renderedRemovers, async (removerRenderedAbsoluteAttrKeyPathParts: string[], removerKey: string) => {
            const {itemKey, renderedRelativeAttrKeyPathParts} = BaseItemsObjectStore
                .separateAbsoluteRenderedAttrKeyPathPartsToRelative(removerRenderedAbsoluteAttrKeyPathParts);

            removedValues[removerKey] = await (async () => {
                if (renderedRelativeAttrKeyPathParts.length > 0) {
                    const matchingRecordWrapper: ImmutableRecordWrapper<T> | null = recordWrappers[itemKey];
                    if (matchingRecordWrapper != null) {
                        alteredAbsoluteRelativeAttrKeyPaths.push(removerRenderedAbsoluteAttrKeyPathParts);
                        return matchingRecordWrapper.removeAttr(renderedRelativeAttrKeyPathParts);
                    } else {
                        return undefined;
                    }
                } else {
                    return await this._updateSingleRecord(itemKey, undefined);
                }
            })();
        }));
        const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(alteredAbsoluteRelativeAttrKeyPaths);
        return {removedValues: removedValues as U.Merge<ImmutableCast<O.P.Pick<{ [recordKey: string]: T }, S.Split<P, ".">>>>, subscribersPromise};
    }

    // LEGACY

    async updateCachedRecordAttr<P extends string>(
        recordKey: string, attrKeyPath: F.AutoPath<T, P>, value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return await this.updateAttr<P>(`${recordKey}.${attrKeyPath}` as any, value as any);
    }

    async updateCachedRecord<P extends string>(key: P, recordData: ImmutableCast<T> | null): Promise<ImmutableCast<T> | undefined> {
        return await this.updateAttr<P>({attrKeyPath: key, valueToSet: recordData});
    }

    async updateCachedRecords(
        recordsData: { [recordKey: string]: ImmutableCast<T> | null }
    ): Promise<{ [recordKey: string]: ImmutableCast<T> | undefined }> {
        const oldRecordsData: { [recordKey: string]: ImmutableCast<T> | undefined } = {};
        const promises: Promise<any>[] = _.map(recordsData, async (recordData: ImmutableCast<T> | null, recordKey: string) => {
            oldRecordsData[recordKey] = await this.updateCachedRecord(recordKey, recordData);
        });
        await Promise.all(promises);
        return oldRecordsData;
    }
}