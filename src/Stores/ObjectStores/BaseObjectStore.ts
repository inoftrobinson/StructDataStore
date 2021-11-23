import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import {BaseStore} from "../BaseStore";
import SubscriptionsManager from "../../SubscriptionsManager";
import {ImmutableCast} from "../../types";
import {
    TypedAttrGetter,
    TypedAttrSelector,
    TypedImmutableAttrSetter,
    TypedAttrSetter,
    TypedAttrRemover
} from "../../models";
import {renderAttrKeyPathWithQueryKwargs} from "../../utils/attrKeyPaths";
import {RenderedTypedAttrSetter, RenderedTypedImmutableAttrSetter} from "../../internalModels";


export interface BaseObjectStoreProps {
}

export abstract class BaseObjectStore<T extends { [p: string]: any }> extends BaseStore {
    public readonly subscriptionsManager: SubscriptionsManager<T>;

    protected constructor(public readonly props: BaseObjectStoreProps) {
        super();
        this.subscriptionsManager = new SubscriptionsManager<T>(this);
    }

    subscribeToAttr<P extends string>({attrKeyPath, queryKwargs, callback}: TypedAttrSelector<T, P> & {callback: () => any}) {
        const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this.subscriptionsManager.subscribeToAttr(renderedAttrKeyPathParts, callback);
    }

    subscribeMultipleAttrs<P extends string>(selectors: TypedAttrSelector<T, P>[], callback: () => any): number {
        const renderedAttrsKeyPathsParts: string[][] = _.map(selectors, (selectorItem: TypedAttrSelector<T, P>) => {
            return renderAttrKeyPathWithQueryKwargs(selectorItem.attrKeyPath, selectorItem.queryKwargs);
        });
        return this.subscriptionsManager.subscribeToMultipleAttrs(renderedAttrsKeyPathsParts, callback);
    }

    unsubscribe(subscriptionIndex: number): undefined {
        return this.subscriptionsManager.unsubscribe(subscriptionIndex);
    }

    triggerSubscribersForAttr<P extends string>({attrKeyPath, queryKwargs}: TypedAttrSelector<T, P>): Promise<void> {
        const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this.subscriptionsManager.triggerSubscribersForAttr(renderedAttrKeyPathParts);
    }

    triggerAllSubscribers(): Promise<void> {
        return this.subscriptionsManager.triggerAllSubscribers();
    }

    abstract clearData(): void;

    abstract loadFromDataWithReturnedSubscribersPromise(data: T): { success: boolean; subscribersPromise: Promise<any> };

    loadFromData(data: T): boolean {
        return this.loadFromDataWithReturnedSubscribersPromise(data).success;
    }

    loadFromJsonifiedDataWithReturnedSubscribersPromise(jsonifiedData: any): { success: boolean; subscribersPromise: Promise<any> } {
        try {
            const parsedData: any = JSON.parse(jsonifiedData);
            if (_.isPlainObject(parsedData)) {
                return this.loadFromDataWithReturnedSubscribersPromise(parsedData);
            } else {
                console.warn(`Parsed data was not a plain object and could not be loaded`);
            }
        } catch (e) {
            console.warn(`JSON Parsing error in loading the jsonified data : ${e}`);
        }
        return {success: false, subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    loadFromJsonifiedData(jsonifiedData: any): boolean {
        return this.loadFromJsonifiedDataWithReturnedSubscribersPromise(jsonifiedData).success;
    }

    protected abstract _getAttr<P extends string>(
        renderedAttrKeyPathParts: string[]
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined>;

    getAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this._getAttr<P>(renderedAttrKeyPathParts);
    }


    protected abstract _getMultipleAttrs<P extends string>(
        getters: { [getterKey: string]: string[] }
    ): Promise<{ [getterKey: string]: any | undefined}>;

    // abstract getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<O.Optional<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>>>>;
    getMultipleAttrs<P extends string>(
        getters: { [getterKey: string]: TypedAttrGetter<T, P> }
    ): Promise<{ [getterKey: string]: any | undefined}> {
        const renderedGetters: { [getterKey: string]: string[] } = _.mapValues(getters, (getterItem: TypedAttrGetter<T, P>) => {
            return renderAttrKeyPathWithQueryKwargs(getterItem.attrKeyPath, getterItem.queryKwargs);
        });
        return this._getMultipleAttrs<P>(renderedGetters);
    }


    protected abstract _updateAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[], valueToSet: ImmutableCast<F.AutoPath<T, P>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

    updateAttrWithReturnedSubscribersPromise<P extends string>(
        // attrKeyPath: F.AutoPath<T, P> | string[], value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
        { attrKeyPath, queryKwargs, valueToSet }: TypedImmutableAttrSetter<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this._updateAttrWithReturnedSubscribersPromise<P>(renderedAttrKeyPathParts, valueToSet);
    }

    async updateAttr<P extends string>(
        // attrKeyPath: F.AutoPath<T, P> | string[], value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
        { attrKeyPath, queryKwargs, valueToSet }: TypedImmutableAttrSetter<T, P>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return (await this.updateAttrWithReturnedSubscribersPromise<P>(
            {attrKeyPath, queryKwargs, valueToSet}
        )).oldValue;
    }


    /*abstract updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: any | undefined, subscribersPromise: Promise<any> }>;*/
    // ObjectFlattenedRecursiveMutatorsResults<any, any>
    protected abstract _updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: RenderedTypedImmutableAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any } | undefined, subscribersPromise: Promise<any> }>;

    updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any } | undefined, subscribersPromise: Promise<any> }> {
        const renderedSetters: { [setterKey: string]: RenderedTypedImmutableAttrSetter<T, P> } = _.mapValues(setters, (setterItem: TypedAttrSetter<T, P>) => {
            const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(setterItem.attrKeyPath, setterItem.queryKwargs);
            return {renderedAttrKeyPathParts, valueToSet: setterItem.valueToSet} as RenderedTypedImmutableAttrSetter<T, P>;
        });
        return this._updateMultipleAttrsWithReturnedSubscribersPromise(renderedSetters);
    }

    /*async updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {
        const recordWrapper: BaseImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const renderedAttrKeyPathsToSetterKeys: { [renderedAttrKeyPath: string]: string } = {};
            const mutatorsRenderedAttrKeyPathsParts: string[][] = [];
            const renderedMutators: { [renderedAttrKeyPath: string]: any } = _.transform(
                setters, (output: { [renderedAttrKeyPath: string]: any }, setterItem: TypedAttrSetter<T, P>, setterKey: string) => {
                    const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(setterItem.attrKeyPath, setterItem.queryKwargs);
                    const renderedAttrKeyPath: string = renderedAttrKeyPathParts.join('.');
                    renderedAttrKeyPathsToSetterKeys[renderedAttrKeyPath] = setterKey;
                    output[renderedAttrKeyPath] = setterItem.valueToSet;
                    mutatorsRenderedAttrKeyPathsParts.push(renderedAttrKeyPathParts);
                }, {}
            );
            const oldValues: { [renderedAttrKeyPath: string]: any } = recordWrapper.updateMultipleAttrs(renderedMutators);
            const subscribersPromise: Promise<any> = this.subscriptionsManager.triggerSubscribersForMultipleAttrs(mutatorsRenderedAttrKeyPathsParts);
            const oldValuesBySettersKeys: { [setterKey: string]: any } = _.transform(
                oldValues, (output: { [setterKey: string]: any }, oldValue: any, renderedAttrKeyPath: string) => {
                    const matchingSetterKey: string | undefined = renderedAttrKeyPathsToSetterKeys[renderedAttrKeyPath];
                    if (matchingSetterKey !== undefined) {
                        output[matchingSetterKey] = oldValue;
                    } else {
                        console.error(`
No matching setter key was found for oldValue of attr at path '${renderedAttrKeyPath}'.
This old value has not been added to the result of the updateMultipleAttrs operation.
This can cause the type inferring to be invalid and some setterKey's to be missing from the result.
                        `);
                    }
                }, {}
            );
            return {oldValues: oldValuesBySettersKeys, subscribersPromise};
        }
        return {oldValues: undefined as any, subscribersPromise: new Promise<void>(resolve => resolve())};
    }
     */

    /*async updateMultipleAttrs<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<any | undefined> {*/
    async updateMultipleAttrs<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ [setterKey: string]: any | undefined }> {
        // ObjectFlattenedRecursiveMutatorsResults<any, any>
        return (await this.updateMultipleAttrsWithReturnedSubscribersPromise<P>(setters)).oldValues;
    }


    protected abstract _updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[], valueToSet: F.AutoPath<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

    updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        {attrKeyPath, queryKwargs, valueToSet}: TypedAttrSetter<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this._updateDataToAttrWithReturnedSubscribersPromise<P>(renderedAttrKeyPathParts, valueToSet);
    }
    /*abstract updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, P>> | undefined, subscribersPromise: Promise<any> }>;*/

    async updateDataToAttr<P extends string>(
        {attrKeyPath, queryKwargs, valueToSet}: TypedAttrSetter<T, P>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
    /*async updateDataToAttr<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<ImmutableCast<O.Path<T, P>> | undefined> {*/
        return (await this.updateDataToAttrWithReturnedSubscribersPromise<P>(
            {attrKeyPath, queryKwargs, valueToSet}
        )).oldValue;
    }


    protected abstract _updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: RenderedTypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined}, subscribersPromise: Promise<any> }>;

    updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined}, subscribersPromise: Promise<any> }> {
        const renderedSetters: { [setterKey: string]: RenderedTypedAttrSetter<T, P> } = _.mapValues(setters, (setterItem: TypedAttrSetter<T, P>) => {
            const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(setterItem.attrKeyPath, setterItem.queryKwargs);
            return {renderedAttrKeyPathParts, valueToSet: setterItem.valueToSet} as RenderedTypedAttrSetter<T, P>;
        });
        return this._updateDataToMultipleAttrsWithReturnedSubscribersPromise<P>(renderedSetters);
    }

    async updateDataToMultipleAttrs<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ [setterKey: string]: any | undefined}> {  // ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined
        return (await this.updateDataToMultipleAttrsWithReturnedSubscribersPromise<P>(setters)).oldValues;
    }


    protected abstract _deleteAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[]
    ): Promise<{ subscribersPromise: Promise<any> }>;

    deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this._deleteAttrWithReturnedSubscribersPromise(renderedAttrKeyPathParts);
    }

    async deleteAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }): Promise<void> {
        await this.deleteAttrWithReturnedSubscribersPromise<P>(attrKeyPath, queryKwargs);
    }


    protected abstract _deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removersRenderedAttrsKeyPathsParts: string[][]
    ): Promise<{ subscribersPromise: Promise<any> }>;

    deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removers: TypedAttrRemover<T, P>[]
    ): Promise<{ subscribersPromise: Promise<any> }> {
        const renderedRemoversAttrsKeyPathsParts: string[][] = _.map(removers, (removerItem: TypedAttrRemover<T, P>) => {
            return renderAttrKeyPathWithQueryKwargs(removerItem.attrKeyPath, removerItem.queryKwargs);
        });
        return this._deleteMultipleAttrsWithReturnedSubscribersPromise<P>(renderedRemoversAttrsKeyPathsParts);
    }

    async deleteMultipleAttrs<P extends string>(removers: TypedAttrRemover<T, P>[]): Promise<void> {
        await this.deleteMultipleAttrsWithReturnedSubscribersPromise<P>(removers);
    }


    protected abstract _removeAttrWithReturnedSubscribersPromise<P extends string>(
        renderedAttrKeyPathParts: string[]
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

    removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }> {
        const renderedAttrKeyPathParts: string[] = renderAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this._removeAttrWithReturnedSubscribersPromise<P>(renderedAttrKeyPathParts);
    }

    async removeAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return (await this.removeAttrWithReturnedSubscribersPromise<P>(attrKeyPath, queryKwargs)).oldValue;
    }


    protected abstract _removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removers: { [removerKey: string]: string[] }
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }>;

    removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removers: { [removerKey: string]: TypedAttrRemover<T, P> }
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }> {
        const renderedRemovers: { [removerKey: string]: string[] } = _.mapValues(removers, (removerItem: TypedAttrRemover<T, P>) => {
            return renderAttrKeyPathWithQueryKwargs(removerItem.attrKeyPath, removerItem.queryKwargs);
        });
        return this._removeMultipleAttrsWithReturnedSubscribersPromise<P>(renderedRemovers);
    }

    async removeMultipleAttrs<P extends string>(
        removers: { [removerKey: string]: TypedAttrRemover<T, P> }
    ): Promise<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined> {
        return (await this.removeMultipleAttrsWithReturnedSubscribersPromise<P>(removers)).removedValues;
    }
}