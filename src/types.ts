import {U, L, O, S, A} from "ts-toolbelt";
import * as immutable from "immutable";


/** Cast all object items to the ImmutableCast and wrap them in an immutable.RecordOf **/
export type CastObjectToImmutable<T extends object> = immutable.RecordOf<U.Merge<{ [K in A.Keys<T>]: ImmutableCast<A.At<T, K>> }>>;

/** Cast all array items to the ImmutableCast and wrap them in an immutable.List **/
export type CastListToImmutable<T extends any[]> = immutable.List<ImmutableCast<T[any]>>;

/**
 * Recursively cast all array's to immutable.List's and objects to immutable.Record's
 * while leaving other values types intact in T, including T itself
 * */
export type ImmutableCast<T> = T extends any[] ? CastListToImmutable<T> : T extends object ? CastObjectToImmutable<T> : T;


// @ts-ignore
export type ObjectFlattenedRecursiveKeys<A extends { [p: string]: any }> = S.Join<L.Required<O.Paths<A>>, '.'>;
// @ts-ignore
export type ObjectOptionalFlattenedRecursiveMutators<A extends { [p: string]: any }> = (
    // @ts-ignore
    O.Optional<{ [K in ObjectFlattenedRecursiveKeys<A>]: ImmutableCast<O.Path<A, S.Split<K, '.'>>> }>
);
export type ObjectOptionalFlattenedRecursiveMutatorsWithoutImmutableCast<A extends { [p: string]: any }> = (
    // @ts-ignore
    O.Optional<{ [K in ObjectFlattenedRecursiveKeys<A>]: O.Path<A, S.Split<K, '.'>> }>
);

