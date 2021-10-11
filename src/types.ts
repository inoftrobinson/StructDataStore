import {U, L, O, S, A} from "ts-toolbelt";


export type ObjectFlattenedRecursiveKeys<A extends { [p: string]: any }> = S.Join<L.Required<O.Paths<A>>, '.'>;
export type ObjectOptionalFlattenedRecursiveMutators<A> = O.Optional<{ [K in ObjectFlattenedRecursiveKeys<A>]: O.Path<A, S.Split<K, '.'>> }>;
export type ObjectFlattenedRecursiveMutatorsResults<A, M extends ObjectOptionalFlattenedRecursiveMutators<A>> = (
    U.Merge<{ [K in A.Keys<M>]: O.Path<A, S.Split<K, '.'>> }>
);
// U.Merge<O.P.Pick<T, S.Split<P, '.'>>>

const rar: ObjectFlattenedRecursiveMutatorsResults<{item1: string, item2: string}, {'item1': "alter2"}> = null as any;
