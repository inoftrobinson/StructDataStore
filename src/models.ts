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

export interface TypedAttrSelector<T extends { [p: string]: any }, P extends string> {
    attrKeyPath: F.AutoPath<T, P>;
    queryKwargs?: { [argKey: string]: any };
}

export type TypedAttrGetter<T extends { [p: string]: any }, P extends string> = TypedAttrSelector<T, P>;

export type TypedAttrRemover<T extends { [p: string]: any }, P extends string> = TypedAttrSelector<T, P>;

export interface TypedAttrSetter<T extends { [p: string]: any }, P extends string> extends TypedAttrSelector<T, P> {
    valueToSet: O.Path<T, S.Split<P, '.'>>;
}

export interface TypedImmutableAttrSetter<T extends { [p: string]: any }, P extends string> extends TypedAttrSelector<T, P> {
    valueToSet: ImmutableCast<O.Path<T, S.Split<P, '.'>>>;
}