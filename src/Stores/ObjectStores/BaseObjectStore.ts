import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {BaseStore} from "../BaseStore";
import SubscriptionsManager from "../../SubscriptionsManager";
import {
    ImmutableCast,
    ObjectFlattenedRecursiveMutatorsResults,
    ObjectOptionalFlattenedRecursiveMutators, ObjectOptionalFlattenedRecursiveMutatorsWithoutImmutableCast,
} from "../../types";
import {
    TypedAttrGetter,
    TypedAttrSelector,
    TypedImmutableAttrSetter,
    TypedAttrSetter,
    TypedAttrRemover
} from "../../models";
import SingleImmutableRecordWrapper from "../../ImmutableRecordWrappers/SingleImmutableRecordWrapper";
import {separateAttrKeyPathWithQueryKwargs, separatePotentialGetterWithQueryKwargs} from "../../utils/attrKeyPaths";
import BaseImmutableRecordWrapper from "../../ImmutableRecordWrappers/BaseImmutableRecordWrapper";


export interface BaseObjectStoreProps {
}

export abstract class BaseObjectStore<T extends { [p: string]: any }> extends BaseStore {
    public readonly subscriptionsManager: SubscriptionsManager<T>;

    protected constructor(public readonly props: BaseObjectStoreProps) {
        super();
        this.subscriptionsManager = new SubscriptionsManager<T>(this);
    }

    subscribeToAttr<P extends string>({attrKeyPath, queryKwargs, callback}: TypedAttrSelector<T, P> & {callback: () => any}) {
        const renderedAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this.subscriptionsManager.subscribeToAttr(renderedAttrKeyPathParts, callback);
    }

    subscribeMultipleAttrs<P extends string>(selectors: TypedAttrSelector<T, P>[], callback: () => any): number {
        const renderedAttrsKeyPathsParts: string[][] = _.map(selectors, (selectorItem: TypedAttrSelector<T, P>) => {
            return separateAttrKeyPathWithQueryKwargs(selectorItem.attrKeyPath, selectorItem.queryKwargs);
        });
        return this.subscriptionsManager.subscribeToMultipleAttrs(renderedAttrsKeyPathsParts, callback);
    }

    unsubscribe(subscriptionIndex: number): undefined {
        return this.subscriptionsManager.unsubscribe(subscriptionIndex);
    }

    triggerSubscribersForAttr<P extends string>({attrKeyPath, queryKwargs}: TypedAttrSelector<T, P>): Promise<void> {
        const renderedAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(attrKeyPath, queryKwargs);
        return this.subscriptionsManager.triggerSubscribersForAttr(renderedAttrKeyPathParts);
    }

    triggerAllSubscribers(): Promise<void> {
        return this.subscriptionsManager.triggerAllSubscribers();
    }

    abstract loadFromData(data: T): { subscribersPromise: Promise<any> };

    loadFromJsonifiedData(jsonifiedData: any): { subscribersPromise: Promise<any> } {
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
        return {subscribersPromise: new Promise<void>(resolve => resolve())};
    }

    abstract getAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, queryKwarg: { [argKey: string]: any }
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined>;

    // abstract getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<O.Optional<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>>>>;
    abstract getMultipleAttrs<P extends string>(getters: { [getterKey: string]: TypedAttrGetter<T, P> }): Promise<{ [getterKey: string]: any | undefined}>

    abstract updateAttrWithReturnedSubscribersPromise<P extends string>(
        // attrKeyPath: F.AutoPath<T, P> | string[], value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
        { attrKeyPath, queryKwargs, valueToSet }: TypedImmutableAttrSetter<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

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
    abstract updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any } | undefined, subscribersPromise: Promise<any> }>;

    /*async updateMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined }, subscribersPromise: Promise<any> }> {
        const recordWrapper: BaseImmutableRecordWrapper<T> | null = await this.getRecordWrapper();
        if (recordWrapper != null) {
            const renderedAttrKeyPathsToSetterKeys: { [renderedAttrKeyPath: string]: string } = {};
            const mutatorsRenderedAttrKeyPathsParts: string[][] = [];
            const renderedMutators: { [renderedAttrKeyPath: string]: any } = _.transform(
                setters, (output: { [renderedAttrKeyPath: string]: any }, setterItem: TypedAttrSetter<T, P>, setterKey: string) => {
                    const renderedAttrKeyPathParts: string[] = separateAttrKeyPathWithQueryKwargs(setterItem.attrKeyPath, setterItem.queryKwargs);
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
        return (await this.updateMultipleAttrsWithReturnedSubscribersPromise(setters)).oldValues;
    }

    abstract updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        {attrKeyPath, queryKwargs, valueToSet}: TypedImmutableAttrSetter<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;
    /*abstract updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, P>> | undefined, subscribersPromise: Promise<any> }>;*/

    async updateDataToAttr<P extends string>(
        {attrKeyPath, queryKwargs, valueToSet}: TypedImmutableAttrSetter<T, P>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
    /*async updateDataToAttr<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<ImmutableCast<O.Path<T, P>> | undefined> {*/
        return (await this.updateDataToAttrWithReturnedSubscribersPromise<P>(
            {attrKeyPath, queryKwargs, valueToSet}
        )).oldValue;
    }

    abstract updateDataToMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ oldValues: { [setterKey: string]: any | undefined}, subscribersPromise: Promise<any> }>;

    async updateDataToMultipleAttrs<P extends string>(
        setters: { [setterKey: string]: TypedAttrSetter<T, P> }
    ): Promise<{ [setterKey: string]: any | undefined}> {  // ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined
        return (await this.updateDataToMultipleAttrsWithReturnedSubscribersPromise<P>(setters)).oldValues;
    }

    abstract deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ subscribersPromise: Promise<any> }>;

    async deleteAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<void> {
        await this.deleteAttrWithReturnedSubscribersPromise<P>(attrKeyPath);
    }

    abstract deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removers: TypedAttrRemover<T, P>[]
    ): Promise<{ subscribersPromise: Promise<any> }>;

    async deleteMultipleAttrs<P extends string>(removers: TypedAttrRemover<T, P>[]): Promise<void> {
        await this.deleteMultipleAttrsWithReturnedSubscribersPromise<P>(removers);
    }

    abstract removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

    async removeAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, queryKwargs?: { [argKey: string]: any }
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return (await this.removeAttrWithReturnedSubscribersPromise<P>(attrKeyPath, queryKwargs)).oldValue;
    }

    abstract removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        removers: { [removerKey: string]: TypedAttrRemover<T, P> }
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }>;

    async removeMultipleAttrs<P extends string>(
        removers: { [removerKey: string]: TypedAttrRemover<T, P> }
    ): Promise<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined> {
        return (await this.removeMultipleAttrsWithReturnedSubscribersPromise<P>(removers)).removedValues;
    }
}