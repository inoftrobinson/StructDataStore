import * as _ from 'lodash';
import BaseField from "./BaseField";
import {separateAttrKeyPath} from "./utils/attrKeyPaths";
import {asyncTriggerSubscribers} from "./utils/async";
import {resolveResultOrPromiseOrCallbackResultOrCallbackPromise} from "../../applications/utils/Comparisons";


export default class RecordSubscriptionsWrapper<T> {
    private readonly objectWideSubscribers: { [index: number]: () => any };
    private readonly attrSubscribers: { [attrKey: string]: { [index: number] : () => any } };
    private readonly subscriptionsIndexesToSubscribedKeyPaths: { [subscriberIndex: number]: string[] };

    constructor(public readonly parent: BaseField) {
        this.objectWideSubscribers = {};
        this.attrSubscribers = {};
        this.subscriptionsIndexesToSubscribedKeyPaths = {};
    }

    get activeSubscribersIndex(): number {
        return this.parent.activeSubscribersIndex;
    }

    set activeSubscribersIndex(value: number) {
        this.parent.activeSubscribersIndex = value;
    }
    
    getNewSubscriptionIndex(): number {
        const subscriptionIndex: number = this.activeSubscribersIndex;
        this.activeSubscribersIndex += 1;
        return subscriptionIndex;
    }
    
    subscribeObjectWide(callback: () => any): number {
        const subscriptionIndex: number = this.getNewSubscriptionIndex();
        this.objectWideSubscribers[subscriptionIndex] = callback;
        return subscriptionIndex;
    }

    private makeAllAttributeKeyPathsCombinations(attrKeyPath: string): string[] {
        const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
        return _.map(attrKeyPathElements, ((__, pathElementIndex: number) => attrKeyPathElements.slice(0, pathElementIndex + 1).join('.')));
    }

    private innerSubscribeToAttrPathElements(attrKeyPath: string, callback: () => any, subscriberIndex: number): string[] {
        const allAttributeKeyPathsCombinations = this.makeAllAttributeKeyPathsCombinations(attrKeyPath);
        _.forEach(allAttributeKeyPathsCombinations, ((attrKeyPathItem: string) => {
            if (!_.hasIn(this.attrSubscribers, attrKeyPathItem)) {
                this.attrSubscribers[attrKeyPathItem] = { [subscriberIndex]: callback };
            } else {
                this.attrSubscribers[attrKeyPathItem][subscriberIndex] = callback;
            }
        }));
        // We subscribe the same callback to all the attr key paths that can be constructed from the the path
        // elements (for example, both we subscribe the same callback to both 'container' and 'container.fieldOne'),
        // which we subscribe using the same subscriber index, to indicate that it is actually the same subscriber.
        return allAttributeKeyPathsCombinations;
    }

    subscribeToAttr(attrKeyPath: string, callback: () => any): number {
        const subscriptionIndex: number = this.getNewSubscriptionIndex();
        const subscribedKeyPaths: string[] = this.innerSubscribeToAttrPathElements(attrKeyPath, callback, subscriptionIndex);
        this.subscriptionsIndexesToSubscribedKeyPaths[subscriptionIndex] = subscribedKeyPaths;
        // We keep track of all the attr keyPath's that our subscriber is subscribed into, in order to
        // remove be able to easily unsubscribe from all of them by just knowing the subscriberIndex.
        return subscriptionIndex;
    }

    subscribeToMultipleAttrs(attrsKeyPaths: string[], callback: () => any): number {
        const subscriptionIndex: number = this.getNewSubscriptionIndex();
        const uniqueSubscribedKeyPaths: string[] = _.uniq(_.flatten(_.map(attrsKeyPaths, (attrKeyPathItem: string) => (
            this.innerSubscribeToAttrPathElements(attrKeyPathItem, callback, subscriptionIndex)
        ))));
        this.subscriptionsIndexesToSubscribedKeyPaths[subscriptionIndex] = uniqueSubscribedKeyPaths;
        return subscriptionIndex;
    }

    async triggerObjectWideSubscribers(): Promise<void> {
        /* Trigger subscribers object wide and the parent field subscribers */
        await Promise.all([
            asyncTriggerSubscribers(this.objectWideSubscribers),
            this.parent.triggerSubscribers()
        ]);
    }

    async triggerSubscribersForAttr(attrKeyPath: string): Promise<void> {
        /* Trigger subscribers for specified attribute key path, its parent items, object wide and the parent field subscribers */
        const promises: Promise<any>[] = [];
        const allAttributeKeyPathsCombinations: string[] = this.makeAllAttributeKeyPathsCombinations(attrKeyPath);
        _.forEach(allAttributeKeyPathsCombinations, (attrKeyPathItem: string) => {
            const subscribersForAttr: { [subscriptionIndex: number]: () => any } | undefined = this.attrSubscribers[attrKeyPathItem];
            if (subscribersForAttr !== undefined) {
                // _.forEach(subscribersForAttr, (callback: () => any) => promises.push(callback()));
                promises.push(asyncTriggerSubscribers(subscribersForAttr));
            }
        });
        promises.push(this.triggerObjectWideSubscribers());
        await Promise.all(promises);
    }

    async triggerSubscribersForMultipleAttrs(attrsKeyPaths: string[]): Promise<void> {
        /* Trigger subscribers for specified attributes keys paths and object wide */
        const promises: Promise<any>[] = [];
        const uniqueSubscriptionsCallbacksToCall: { [subscriptionIndex: number]: () => any } = {};
        _.forEach(attrsKeyPaths, (attrKeyPath: string) => {
            const subscribersForAttr: { [subscriptionIndex: number]: () => any } | undefined = this.attrSubscribers[attrKeyPath];
            if (subscribersForAttr !== undefined) {
                _.forEach(subscribersForAttr, (callback: () => any, subscriptionIndex: any) => {
                    uniqueSubscriptionsCallbacksToCall[subscriptionIndex] = callback;
                });
            }
        });
        // _.forEach(uniqueSubscriptionsCallbacksToCall, (callback: () => any) => callback());
        // promises.push(asyncTriggerSubscribers(uniqueSubscriptionsCallbacksToCall));
        promises.push(..._.map(uniqueSubscriptionsCallbacksToCall, (callback: () => any) => (
            resolveResultOrPromiseOrCallbackResultOrCallbackPromise(callback())
        )));
        promises.push(..._.map(this.objectWideSubscribers, (callback: () => any) => (
            resolveResultOrPromiseOrCallbackResultOrCallbackPromise(callback())
        )));
        promises.push(..._.map(this.parent.subscribers, (callback: () => any) => (
            resolveResultOrPromiseOrCallbackResultOrCallbackPromise(callback())
        )));
        // promises.push(this.triggerObjectWideSubscribers());
        await Promise.all(promises);
    }

    async triggerAllSubscribers(): Promise<void> {
        /* Trigger subscribers for all attributes and object wide */
        await this.triggerSubscribersForMultipleAttrs(Object.keys(this.attrSubscribers));
    }

    unsubscribe(subscriptionIndex: number): undefined {
        /* Delete an object wide or a single/multi attribute subscription from its subscription index */

        // First delete the potential object wide subscription
        delete this.objectWideSubscribers[subscriptionIndex];

        // Then delete the subscription from all its subscribed key paths (remember, the same subscription with the
        // same subscription index can be applied across multiple key paths when subscribing to multiple attributes).
        const keyPathsToUnsubscribe: string[] | undefined = this.subscriptionsIndexesToSubscribedKeyPaths[subscriptionIndex];
        if (keyPathsToUnsubscribe !== undefined) {
            keyPathsToUnsubscribe.forEach((keyPath: string) => {
                delete this.attrSubscribers[keyPath][subscriptionIndex];
            });
        }
        return undefined;
    }
}