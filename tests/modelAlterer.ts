import {A, F, O, S, U, L} from 'ts-toolbelt';
import * as immutable from 'immutable';
import {CastListToImmutable, ImmutableCast} from "../src/types";

interface StoreModel {
    value1: string;
    container1: {
        field1: string;
        nestedContainer1: {
            subField1: string;
        }
    };
    list: {
        value: number;
        subList: string[];
    }[];
}

// A.Cast<'42', number>
// type objectToRecord<T extends { [attrKey: string]: any }> = U.Merge<{ [K in A.Keys<T>]: A.Cast<O.Path<T, S.Split<K, '.'>>, object> }>;
// type rar<T extends { [attrKey: string]: any }> = A.Extends<O.Path<T, S.Split<K, '.'>>, object> ? 1 : 0;
type objectToRecord<T extends { [attrKey: string]: any }> = U.Merge<{ [K in A.Keys<T>]: A.Extends<T[K], object> extends true ? immutable.RecordOf<A.Cast<T[K], object>> : T[K]}>;


type RecordStoreModel = ImmutableCast<StoreModel>;
const recordStoreModel: RecordStoreModel = null as any;
const rar2 = recordStoreModel.list.get(0);

type Equal<T> = A.Equals<T, T> extends 1 ? 'yes' : 'no';
const isEqual: Equal<StoreModel> = null as any;
// is


const castedList: CastListToImmutable<[1, 2, 3], [1, 2, 3]> = null as any;
// castedList

const castedNumber: CastListToImmutable<1, 1> = null as any;
// castedNumber.

const castedObject: CastListToImmutable<{}, {}> = null as any;


const rar3: S.Split<O.Paths<{ container: { field1: number } }>, 'container'> = null as any;
