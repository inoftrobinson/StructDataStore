import * as _ from 'lodash';
import BaseField from "./BaseField";


interface BaseFieldProps {
    retrieveDataCallable: () => Promise<any>;
    onRetrievalFailure?: (responseData: any) => any;
}

export class ValueField<T> extends BaseField {
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

    getValue(): Promise<T | null> {
        return this.CACHED_VALUE !== undefined ?
            new Promise(resolve => resolve(this.CACHED_VALUE)) :
            this.retrieveAndCacheValue();
    }

    updateCachedValue(value: T): T | undefined {
        const existingValue: T | undefined = this.CACHED_VALUE;
        this.CACHED_VALUE = value;
        this.triggerSubscribers();
        return existingValue;
    }
}
