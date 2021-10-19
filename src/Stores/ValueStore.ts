import * as _ from 'lodash';
import {BaseStore} from "./BaseStore";


interface BaseFieldProps {
    retrieveDataCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export class ValueStore<T> extends BaseStore {
    public CACHED_VALUE?: T;
    private pendingRetrievalPromise?: Promise<T | null>;

    constructor(public readonly props: BaseFieldProps) {
        super();
    }

    retrieveAndCacheValue(): Promise<T | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<T | null> = this.props.retrieveDataCallable().then(responseData => {
                this.pendingRetrievalPromise = undefined;
                if (responseData.success === true) {
                    const value: T = responseData.data;
                    this.updateCachedValue(value);
                    return value;
                } else {
                    this.props.onRetrievalFailure?.(responseData);
                    return null;
                }
            });
            this.pendingRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }

    async getValue(): Promise<T | null> {
        return this.CACHED_VALUE !== undefined ? this.CACHED_VALUE : this.retrieveAndCacheValue();
    }

    updateCachedValue(value: T): T | undefined {
        return this.updateCachedValueWithReturnedSubscribersPromise(value).oldValue;
    }

    updateCachedValueWithReturnedSubscribersPromise(value: T): { oldValue: T | undefined, subscribersPromise: Promise<any> } {
        const existingValue: T | undefined = this.CACHED_VALUE;
        this.CACHED_VALUE = value;
        const subscribersPromise = this.triggerSubscribers();
        return {oldValue: existingValue, subscribersPromise};
    }

    clearValue(): void {
        this.CACHED_VALUE = undefined;
    }
}
