import {U, L, O, S, A} from "ts-toolbelt";
import * as immutable from "immutable";


// @ts-ignore
export type ObjectFlattenedRecursiveKeys<A extends { [p: string]: any }> = S.Join<L.Required<O.Paths<A>>, '.'>;
// @ts-ignore
export type ObjectOptionalFlattenedRecursiveMutators<A extends { [p: string]: any }> = (
    // @ts-ignore
    O.Optional<{ [K in ObjectFlattenedRecursiveKeys<A>]: O.Path<A, S.Split<K, '.'>> }>
);
// @ts-ignore
export type ObjectFlattenedRecursiveMutatorsResults<A, M extends ObjectOptionalFlattenedRecursiveMutators<A>> = (
    // @ts-ignore
    U.Merge<{ [K in A.Keys<M>]: O.Path<A, S.Split<K, '.'>> }>
);
// U.Merge<O.P.Pick<T, S.Split<P, '.'>>>

// const rar: ObjectFlattenedRecursiveMutatorsResults<{item1: string, item2: string}, {'item1': "alter2"}> = null as any;


export type CastObjectToImmutable<T, C> = A.Extends<T, O.Object> extends 1 ? immutable.RecordOf<U.Merge<{ [K in A.Keys<T>]: FullImmutableCast<A.At<T, K>> }>> : C;

// type CastListToImmutable<T, C> = A.Extends<T, L.List> extends 1 ? immutable.List<A.Cast<T, L.List>> : C;
export type CastListToImmutable<T, C> = A.Extends<T, L.List> extends 1 ? immutable.List<O.UnionOf<{ [K in A.Keys<T>]: FullImmutableCast<A.At<T, K>> }>> : C;
// type CastListToImmutable<T, C> = A.Extends<T, L.List> extends 1 ? immutable.List<FullCast<T>> : C;
 // todo: simplify CastListToImmutable

export type FullImmutableCast<T> = CastListToImmutable<T, CastObjectToImmutable<T, T>>;
