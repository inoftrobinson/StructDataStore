import * as immutable from 'immutable';
import {F, O, A, S} from 'ts-toolbelt';
import {ImmutableCast} from "./types";


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

export interface PrimitiveAttrGetter {
    attrKeyPath: string;
    queryKwargs?: { [argKey: string]: any };
}

export interface TypedAttrGetter<T extends { [p: string]: any }, P extends string> {
    attrKeyPath: F.AutoPath<T, P>;
    queryKwargs?: { [argKey: string]: any };
}

export interface TypedFieldGetter<T extends { [p: string]: any }, P extends string> {
    attrKeyPath: F.AutoPath<T, P>;
    queryKwargs?: { [argKey: string]: any };
}

export interface TypedSetterItem<T extends { [p: string]: any }, P extends string> {
    attrKeyPath: F.AutoPath<T, P>;
    queryKwargs?: { [argKey: string]: any };
    valueToSet: O.Path<T, S.Split<P, '.'>>;
}

export interface TypedImmutableSetterItem<T extends { [p: string]: any }, P extends string> {
    attrKeyPath: F.AutoPath<T, P>;
    queryKwargs?: { [argKey: string]: any };
    valueToSet: ImmutableCast<O.Path<T, S.Split<P, '.'>>>;
}

export interface InternalTypedSetterItem<T extends { [p: string]: any }, P extends string> {
    attrKeyPath: F.AutoPath<T, P>;
    queryKwargs?: { [argKey: string]: any };
    valueToSet: O.Path<T, S.Split<P, '.'>>;
}