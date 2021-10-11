import {F, O, S, U, L, S} from 'ts-toolbelt';

// declare const d: unique symbol
interface Context {
    str: string;
    num: number;
    nested: {
        value: number;
        nested2: {
            value2: string;
        };
    };
}

type Keys<A extends { [attrKey: string]: any }> = S.Join<L.Required<O.Paths<A>>, '.'>

type Regev<A> = {
    [K in Keys<A>]: {
        propertyPath: K
        type: O.Path<A, S.Split<K, '.'>>
    }
}

type t = Regev<Context>;
const eee: t = null as t;

type keys<A> = Keys<A>;
const keysRar: keys<Context> = null as any;

type Regev2<A> = O.Optional<{
    [K in Keys<A>]: O.Path<A, S.Split<K, '.'>>
}>
const rar3: Regev2<Context> = null as t;

function setDeep<T>(mutators: Regev2<T>) {

}
setDeep<Context>({
    'nested.value': 10
})