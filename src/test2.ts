import {
    A,
    F,
    B,
    O,
    I,
    L,
    M
} from 'ts-toolbelt';

type OnlyUserKeys<O> =
    O extends L.List
    ? keyof O & number
    : O extends M.BuiltInObject
      ? never
      : keyof O & (string | number)

type PathsDot<O, I extends I.Iteration = I.IterationOf<'0'>> =
    9 extends I.Pos<I> ? never :
    O extends object
    ? {[K in keyof O & OnlyUserKeys<O>]:
        `${K}` | `${K}.${PathsDot<O[K], I.Next<I>>}`
      }[keyof O & OnlyUserKeys<O>]
    : never
type PathDot<O, P extends string, strict extends B.Boolean = 1> =
    P extends `${infer K}.${infer Rest}`
    ? PathDot<O.At<O & {}, K, strict>, Rest, strict>
    : O.At<O & {}, P, strict>;

type Obj = {
    a: Obj[],
    b: { c: Obj},
    d: 40
    e: 50
};

declare const object: Obj;
declare function get<O extends object, P extends string>(
    obj: O, path: A.Cast<P, PathsDot<O>>
): PathDot<O, P>;

const test0 = get(object, 'a.45.b.c.a.100.a.45.e');
const test1 = get(object, 'a.45.b.c.a.100.a.45.x');