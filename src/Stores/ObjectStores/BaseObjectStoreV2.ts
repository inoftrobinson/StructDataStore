import {F, O, S, U, L} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {MapModel} from "../../ModelsFields";
import BaseStore from "../BaseStore";
import SubscriptionsManager from "../../SubscriptionsManager";
import {
    ObjectFlattenedRecursiveMutatorsResults,
    ObjectOptionalFlattenedRecursiveMutators,
} from "../../types";


export interface BaseObjectProps {
}

export default abstract class BaseObjectStoreV2<T extends { [attrKeyPath: string]: any }> extends BaseStore {
    public readonly subscriptionsManager: SubscriptionsManager<T>;

    protected constructor(public readonly props: BaseObjectProps) {
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

    abstract loadFromData(data: T): { item: immutable.RecordOf<T> | undefined, subscribersPromise: Promise<any> };

    abstract loadFromJsonifiedData(jsonifiedRecordsData: any): { item: immutable.RecordOf<T> | undefined, subscribersPromise: Promise<any> } | null;

    abstract getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<O.Path<T, S.Split<P, '.'>>>;

    abstract getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<U.Merge<O.P.Pick<T, S.Split<P, '.'>>>>;

    // todo: implement two function (one with returned subscribers promise and the other not) for all operations
    abstract updateAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }>;

    async updateAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<O.Path<T, S.Split<P, '.'>> | undefined> {
        return (await this.updateAttrWithReturnedSubscribersPromise<P>(attrKeyPath, value)).oldValue;
    }

    abstract updateDataToAttrWithReturnedSubscribersPromise<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }>;

    async updateDataToAttr<P extends string>(
        attrKeyPath: F.AutoPath<T, P>, value: O.Path<T, S.Split<P, '.'>>
    ): Promise<O.Path<T, S.Split<P, '.'>> | undefined> {
        return (await this.updateDataToAttrWithReturnedSubscribersPromise<P>(attrKeyPath, value)).oldValue;
    }

    abstract updateMultipleAttrsWithReturnedSubscribersPromise<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<{ oldValues: ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined, subscribersPromise: Promise<any> }>;

    async updateMultipleAttrs<M extends ObjectOptionalFlattenedRecursiveMutators<T>>(
        mutators: M
    ): Promise<ObjectFlattenedRecursiveMutatorsResults<T, M> | undefined> {
        return (await this.updateMultipleAttrsWithReturnedSubscribersPromise(mutators)).oldValues;
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
    ): Promise<{ oldValue: O.Path<T, S.Split<P, '.'>> | undefined, subscribersPromise: Promise<any> }>;

    async removeAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): Promise<O.Path<T, S.Split<P, '.'>> | undefined> {
        return (await this.removeAttrWithReturnedSubscribersPromise<P>(attrKeyPath)).oldValue;
    }

    abstract removeMultipleAttrsWithReturnedSubscribersPromise<P extends string>(
        attrsKeyPaths: F.AutoPath<T, P>[]
    ): Promise<{ removedValues: U.Merge<O.P.Pick<T, S.Split<P, '.'>>> | undefined, subscribersPromise: Promise<any> }>;

    async removeMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): Promise<U.Merge<O.P.Pick<T, S.Split<P, '.'>>> | undefined> {
        return (await this.removeMultipleAttrsWithReturnedSubscribersPromise<P>(attrsKeyPaths)).removedValues;
    }
}