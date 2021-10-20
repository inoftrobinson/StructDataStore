import {U, L, O, S, A} from "ts-toolbelt";
import * as immutable from "immutable";


/** Cast all object items to the ImmutableCast if T is an object, otherwise returns C (continuation Type) **/
export type CastObjectToImmutable<T, C> = A.Extends<T, O.Object> extends 1 ? immutable.RecordOf<U.Merge<{ [K in A.Keys<T>]: ImmutableCast<A.At<T, K>> }>> : C;

// type CastListToImmutable<T, C> = A.Extends<T, L.List> extends 1 ? immutable.List<A.Cast<T, L.List>> : C;
// type CastListToImmutable<T, C> = A.Extends<T, L.List> extends 1 ? immutable.List<FullCast<T>> : C;
/** Cast all array items to the ImmutableCast if T is an array, otherwise returns C (continuation Type) **/
export type CastListToImmutable<T, C> = A.Extends<T, L.List> extends 1 ? immutable.List<O.UnionOf<{ [K in A.Keys<T>]: ImmutableCast<A.At<T, K>> }>> : C;
 // todo: simplify CastListToImmutable

/**
 * Recursively cast all array's to immutable.List's and objects to immutable.Record's
 * while leaving other values types intact in T, including T itself
 * */
export type ImmutableCast<T> = CastListToImmutable<T, CastObjectToImmutable<T, T>>;


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
// @ts-ignore
export type ObjectFlattenedRecursiveMutatorsResults<A, M extends ObjectOptionalFlattenedRecursiveMutators<A>> = (
    // @ts-ignore
    U.Merge<{ [K in A.Keys<M>]: ImmutableCast<O.Path<A, S.Split<K, '.'>>> }>
);

// const rar: ObjectFlattenedRecursiveMutatorsResults<{item1: string, item2: string}, {'item1': "alter2"}> = null as any;
