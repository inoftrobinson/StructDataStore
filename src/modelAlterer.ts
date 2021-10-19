import {A, F, O, S, U, L} from 'ts-toolbelt';
import * as immutable from 'immutable';

interface StoreModel {
    value1: string;
    container1: {
        field1: string;
    };
    list: string[];
}

function modelToRecord() {

}

// A.Cast<'42', number>
// type objectToRecord<T extends { [attrKey: string]: any }> = U.Merge<{ [K in A.Keys<T>]: A.Cast<O.Path<T, S.Split<K, '.'>>, object> }>;
// type rar<T extends { [attrKey: string]: any }> = A.Extends<O.Path<T, S.Split<K, '.'>>, object> ? 1 : 0;
type objectToRecord<T extends { [attrKey: string]: any }> = U.Merge<{ [K in A.Keys<T>]: A.Extends<T[K], object> extends true ? immutable.RecordOf<A.Cast<T[K], object>> : T[K]}>;

type CastListToImmutable<T> = A.Extends<T, L.List> extends 1 ? immutable.List<A.Cast<T, object>> : T;
type listToMap<T extends { [attrKey: string]: any }> = U.Merge<{ [K in A.Keys<T>]: CastListToImmutable<A.At<T, K>>}>;
// type listToMap<T extends { [attrKey: string]: any }> = U.Merge<{ [K in A.Keys<T>]: immutable.List<A.Cast<A.At<T, K>, object>> }>;


type AlteredStoreModel = objectToRecord<StoreModel>;
const alteredStoreModel: AlteredStoreModel = null as any;
// alteredStoreModel.container1

type AlteredListStoreModel = listToMap<StoreModel>;
const alteredListStoreModel: AlteredListStoreModel = null as any;
// alteredListStoreModel.container1

type Equal<T> = A.Equals<T, T> extends 1 ? 'yes' : 'no';
const isEqual: Equal<StoreModel> = null as any;
// is


const castedList: CastListToImmutable<[1, 2, 3]> = null as any;
// castedList

const castedNumber: CastListToImmutable<1> = null as any;
// castedNumber.

const castedObject: CastListToImmutable<{}> = null as any;

