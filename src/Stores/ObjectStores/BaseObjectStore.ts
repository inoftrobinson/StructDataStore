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


export interface BaseObjectStoreProps {
}

export abstract class BaseObjectStore<T extends { [p: string]: any }> extends BaseStore {
    public readonly subscriptionsManager: SubscriptionsManager<T>;

    protected constructor(public readonly props: BaseObjectStoreProps) {
        super();
        this.subscriptionsManager = new SubscriptionsManager<T>(this);
    }

    subscribeToAttr(attrKeyPath: string, callback: () => any) {
        return this.subscriptionsManager.subscribeToAttr(attrKeyPath, callback);
    }

    subscribeMultipleAttrs(attrsKeyPaths: string[], callback: () => any): number {
        return this.subscriptionsManager.subscribeToMultipleAttrs(attrsKeyPaths, callback);
    }

    unsubscribe(subscriptionIndex: number): undefined {
        return this.subscriptionsManager.unsubscribe(subscriptionIndex);
    }

    triggerSubscribersForAttr(attrKeyPath: string): Promise<void> {
        return this.subscriptionsManager.triggerSubscribersForAttr(attrKeyPath);
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

    abstract getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined>;

    abstract getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<O.Optional<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>>>>;

    abstract updateAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P> | string[], value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

    async updateAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P> | string[], value: ImmutableCast<O.Path<T, S.Split<P, '.'>>>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return (await this.updateAttrWithReturnedSubscribersPromise<P>(attrKeyPath, value)).oldValue;
    }

    abstract updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: any | undefined, subscribersPromise: Promise<any> }>;
    // ObjectFlattenedRecursiveMutatorsResults<any, any>

    async updateMultipleAttrs<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<any | undefined> {
        // ObjectFlattenedRecursiveMutatorsResults<any, any>
        return (await this.updateMultipleAttrsWithReturnedSubscribersPromise(mutators)).oldValues;
    }

    abstract updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;
    abstract updateDataToAttrWithReturnedSubscribersPromise<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, P>> | undefined, subscribersPromise: Promise<any> }>;

    async updateDataToAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined>;
    async updateDataToAttr<P extends O.Paths<T>>(
        attrKeyPath: P, value: O.Path<T, P>
    ): Promise<ImmutableCast<O.Path<T, P>> | undefined> {
        return (await this.updateDataToAttrWithReturnedSubscribersPromise<P>(attrKeyPath, value)).oldValue;
    }

    abstract updateDataToMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutatorsWithoutImmutableCast<any>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<any, any> | undefined, subscribersPromise: Promise<any> }>;

    async updateDataToMultipleAttrs<M extends ObjectOptionalFlattenedRecursiveMutatorsWithoutImmutableCast<T>>(
        mutators: M
    ): Promise<any> {  // ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined
        return (await this.updateDataToMultipleAttrsWithReturnedSubscribersPromise<M>(mutators)).oldValues;
    }

    abstract deleteAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ subscribersPromise: Promise<any> }>;

    async deleteAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<void> {
        await this.deleteAttrWithReturnedSubscribersPromise<P>(attrKeyPath);
    }

    abstract deleteMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ subscribersPromise: Promise<any> }>;

    async deleteMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<void> {
        await this.deleteMultipleAttrsWithReturnedSubscribersPromise<P>(attrsKeyPaths);
    }

    abstract removeAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>
    ): Promise<{ oldValue: ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

    async removeAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<ImmutableCast<O.Path<T, S.Split<P, '.'>>> | undefined> {
        return (await this.removeAttrWithReturnedSubscribersPromise<P>(attrKeyPath)).oldValue;
    }

    abstract removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ removedValues: U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined, subscribersPromise: Promise<any> }>;

    async removeMultipleAttrs<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<U.Merge<ImmutableCast<O.P.Pick<T, S.Split<P, '.'>>>> | undefined> {
        return (await this.removeMultipleAttrsWithReturnedSubscribersPromise<P>(attrsKeyPaths)).removedValues;
    }
}