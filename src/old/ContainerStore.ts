import * as _ from 'lodash';
import * as immutable from 'immutable';
import {ChildObjectStore} from "./ObjectStores/ObjectStores";


export interface ContainerFieldProps<T extends { [ childKey: string]: any }> {
    children: T;
    retrieveDataCallable: () => any;
    onRetrievalFailure: (responseData: any) => any;
}

export default class ContainerStore<T extends {}> {
    private pendingRetrievalPromise?: Promise<{ [key: string]: immutable.RecordOf<T> } | null>;
    private activeSubscribersIndex: number;
    private readonly subscribers: { [index: number]: { [childKey: string]: number } };

    constructor(public readonly props: ContainerFieldProps<T>) {
        this.activeSubscribersIndex = 0;
        this.subscribers = {};
        _.forEach(this.props.children as {}, (child: ChildObjectStore<any>) => child.registerParentField(this));
    }

    get children() {
        return this.props.children;
    }

    subscribe(callback: () => any): number {
        const index: number = this.activeSubscribersIndex;
        this.subscribers[index] = _.mapValues(
            this.props.children as { [childKey: string]: ChildObjectStore<any> },
            (child: ChildObjectStore<any>) => child.subscribe(callback)
        );
        this.activeSubscribersIndex += 1;
        return index;
    }

    unsubscribe(index: number): undefined {
        const childrenSubscriptions: { [childKey: string]: number } = this.subscribers[index];
        _.forEach(childrenSubscriptions, (childSubscriptionIndex: number, childKey: string) => {
            (this.children[childKey] as ChildObjectStore<any>).unsubscribe(childSubscriptionIndex);
        });
        delete this.subscribers[index];
        return undefined;
    }

    loadRecordsFromJsonifiedData(jsonifiedRecordsData: any): boolean {
        try {
            const parsedRecordsData: any = JSON.parse(jsonifiedRecordsData);
            if (_.isPlainObject(parsedRecordsData)) {
                _.forEach(this.children as {}, (childField: ChildObjectStore<any>, childKey: string) => {
                    const matchingDataItem: any | undefined = parsedRecordsData[childKey];
                    childField.loadDataToRecords(matchingDataItem);
                });
                return true;
            }
        } catch (e) {
            console.log(`JSON Parsing error in loading the jsonified data : ${e}`);
        }
        return false;
    }

    retrieveAndCacheRecordsIntoChildren(): Promise<{ [key: string]: immutable.RecordOf<T> } | null>  {
        if (this.pendingRetrievalPromise !== undefined) {
            return this.pendingRetrievalPromise;
        } else {
            const retrievalPromise: Promise<{ [key: string]: immutable.RecordOf<T> | null }> = this.props.retrieveDataCallable().then(responseData => {
                this.pendingRetrievalPromise = undefined;
                if (responseData.success === true && responseData.data != null) {
                    _.forEach(this.children as {}, (childField: ChildObjectStore<any>, childKey: string) => {
                        const matchingDataItem: any | undefined = responseData.data[childKey];
                        childField.loadDataToRecords(matchingDataItem);
                    });
                } else {
                    this.props.onRetrievalFailure?.(responseData);
                    return null;
                }
            });
            this.pendingRetrievalPromise = retrievalPromise;
            return retrievalPromise;
        }
    }
}