import * as immutable from 'immutable';


export interface CreateUpdateRecordResponse<T extends { [p: string]: any }> {
    success: boolean;
    newRecord?: immutable.RecordOf<T>;
    previousRecord?: immutable.RecordOf<T>;
    subscribersPromise: Promise<any>;
}