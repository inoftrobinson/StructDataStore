import * as immutable from 'immutable';


export interface CreateUpdateRecordResponse<T extends { [p: string]: any }> {
    success: boolean;
    newRecord?: immutable.RecordOf<T>;
    previousRecord?: immutable.RecordOf<T>;
    subscribersPromise: Promise<any>;
}

export interface BaseDataRetrievalPromiseResult<T> {
    success: boolean;
    data: T | null;
    metadata?: { [metadataKey: string]: any };
}