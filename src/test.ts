export interface Model {
    container: {
        item1: number;
        sub: {
            subItem: string;
        }
    },
    container2: {
        item2: number;
    }
}

export function dynamicRetrieval<T extends keyof Model>(fieldPath: T): Model[T] {
    return ({} as Model)[fieldPath];
}


export function dynamicRetrieval2<T extends keyof Model, T2 extends keyof Model>(t1: T, t2: T2): `${T}.${T2}` {
    return ({} as Model)[t1][t2];
}

dynamicRetrieval('container')


type Join<K, P> = K extends string | number ? P extends string | number ? `${K}${"" extends P ? "" : "."}${P}` : never : never;

type Paths<T, D extends number = 10> = [D] extends [never] ? never : T extends object ?
    { [K in keyof T]-?: K extends string | number ?
        `${K}` | Join<K, Paths<T[K], Prev[D]>>
        : never
    }[keyof T] : ""

type Leaves<T, D extends number = 10> = [D] extends [never] ? never : T extends object ?
    { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T] : "";

type NestedObjectPaths = Paths<NestedObjectType>;
// type NestedObjectPaths = "a" | "b" | "nest" | "otherNest" | "nest.c" | "otherNest.c"
type NestedObjectLeaves = Leaves<NestedObjectType>
// type NestedObjectLeaves = "a" | "b" | "nest.c" | "otherNest.c"

type MyGenericType<T extends object> = {
    keys: Array<Paths<T>>;
};

const test: MyGenericType<NestedObjectType> = {
    keys: ["a", "nest.c"]
}


type Split<S extends string, D extends string> =
    string extends S ? string[] :
    S extends '' ? [] :
    S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] :
    [S];

type Split2<S extends string, D extends string, M extends Model> =
    string extends S ? string[] :
    S extends '' ? [] :
    S extends `${infer T}${infer M}[${D}]${infer U}` ? [T, ...Split2<U, D, M>] :
    [S];

type T39 = Split2<'rar', '.', Model>;
const rar: T39 = (0 as T39);

type T40 = Split<'foo', '.'>;  // ['foo']
type T41 = Split<'foo.bar.baz', '.'>;  // ['foo', 'bar', 'baz']
type T42 = Split<'foo.bar', ''>;  // ['f', 'o', 'o', '.', 'b', 'a', 'r']
type T43 = Split<any, '.'>;  // string[]