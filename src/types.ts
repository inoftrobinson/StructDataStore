import {U, L, O, S, A} from "ts-toolbelt";
import * as immutable from "immutable";
import {TypedAttrSetter} from "./models";


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

/*type JoinedPaths<T> = S.Join<O.Paths<T>, '.'>;
const paths = O.Paths<{ container: { field1: number}, container2: { field1: number } }> = null as any;
const joinedPaths: JoinedPaths<{ container: { field1: number}, container2: { field1: number } }> = null as any;
joinedPaths*/

export type ObjectOptionalFlattenedRecursiveMutatorsWithSetterKeys<
    T extends { [p: string]: any }, S extends { [setterKey: string]: TypedAttrSetter<T, any> }
    // { attrKeyPath: keyof O.Paths<T>; queryKwargs?: any; valueToSet: any; }
> = (
    { [K in A.Keys<S>]: O.Path<T, S[K]['attrKeyPath']>}
    // O.Optional<{ [K in ObjectFlattenedRecursiveKeys<A>]: ImmutableCast<O.Path<A, S.Split<K, '.'>>> }>
);
// function rar<T extends { [p: string]: any }, S extends { [setterKey: string]: TypedAttrSetter<T, any> }>(
// S.Join<O.Paths<T>, '.'>

interface BasicStoreContainerModel {
    container: {
        field1: number;
    }
}

export type SetterItem<P extends string> = { attrKeyPath: P, valueToSet: O.Path<BasicStoreContainerModel, S.Split<P, '.'>> };
function rar<P extends string, Setters extends { [setterKey: string]: { attrKeyPath: P, valueToSet: O.Path<BasicStoreContainerModel, S.Split<P, '.'>> } }>(
// function rar<S extends { [setterKey: string]: { attrKeyPath: string } }>(
// function rar<P extends string, S extends { [setterKey: string]: SetterItem<P> }>(
    //setters: { [K in A.Keys<S>]: TypedAttrSetter<{container: {field1: number}}, P> }
    // setters: { [K in A.Keys<S>]: { attrKeyPath: P, valueToSet: O.Path<{container: {field1: number}}, S[K]['attrKeyPath']> } }
    // setters: { [K in A.Keys<S>]: { attrKeyPath: P, valueToSet: O.Path<{container: {field1: number}}, S[K]['attrKeyPath']> } }
    // setters: { [K in A.Keys<S>]: SetterItem<S[K]['attrKeyPath']> }
    setters: Setters
): { [SetterKey in keyof Setters]: O.Path<BasicStoreContainerModel, S.Split<Setters[SetterKey]["attrKeyPath"], '.'>> } {
// : ObjectOptionalFlattenedRecursiveMutatorsWithSetterKeys<{container: {field1: number}}, S> {
    return null as any;
}
const setterItems = {'setterOne': {attrKeyPath: 'container', valueToSet: 42}};
// rar<{container: {field1: number}}, {'setterOne': {attrKeyPath: 'container', valueToSet: 42}}>(setterItems).setterOne;
const result1 = rar({'setterOne': {attrKeyPath: 'container', valueToSet: {field1: 42}}});
// result1.setterOne
// const result2 = rar<'container', {'setterOne': {attrKeyPath: 'container', valueToSet: "invalid"}}>({'setterOne': {attrKeyPath: 'container', valueToSet: "invalid"}});

/*type SettersContainer<Setters extends { [setterKey: string]: { attrKeyPath: string, valueToSet: any } }> = (
    { [SetterKey in keyof Setters]: {
        attrKeyPath: Setters[SetterKey]["attrKeyPath"],
        valueToSet: O.Path<BasicStoreContainerModel, S.Split<'container', '.'>>
    } }
);*/
type SettersContainer<Setters extends { [setterKey: string]: { attrKeyPath: O.Paths<BasicStoreContainerModel>, valueToSet: any } }> = (
    { [SetterKey in A.Keys<Setters>]: {
        attrKeyPath: Setters[SetterKey]["attrKeyPath"],
        valueToSet: O.Path<BasicStoreContainerModel, S.Split<'container', '.'>>
    } }
);
function rar2<Setters extends { [setterKey: string]: { attrKeyPath: O.Paths<BasicStoreContainerModel>, placeholder: any } }>(
    setters: SettersContainer<Setters> | Setters
): { [SetterKey in keyof Setters]: O.Path<BasicStoreContainerModel, S.Split<Setters[SetterKey]["attrKeyPath"], '.'>> } {
    // O.Path<BasicStoreContainerModel, S.Split<Setters[SetterKey]["attrKeyPath"], '.'>>
    return null as any;
}
function rar2Wrapper<Setters extends { [setterKey: string]: { attrKeyPath: string, valueToSet: any } }>(
    setters: Setters
): { [SetterKey in keyof Setters]: O.Path<BasicStoreContainerModel, S.Split<Setters[SetterKey]["attrKeyPath"], '.'>> } {
    return rar2(setters);
}
const result = rar2({'setterOne': {attrKeyPath: 'rar', valueToSet: {field1: 42}}});


// @ts-ignore
export type ObjectFlattenedRecursiveMutatorsResults<A, M extends ObjectOptionalFlattenedRecursiveMutators<A>> = (
    // @ts-ignore
    U.Merge<{ [K in A.Keys<M>]: ImmutableCast<O.Path<A, S.Split<K, '.'>>> }>
);

// const rar: ObjectFlattenedRecursiveMutatorsResults<{item1: string, item2: string}, {'item1': "alter2"}> = null as any;
