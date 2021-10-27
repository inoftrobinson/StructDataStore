import {O, S} from "ts-toolbelt";
import {ImmutableCast} from "./types";


export interface RenderedTypedAttrSetter<T extends { [p: string]: any }, P extends string> {
    renderedAttrKeyPathParts: string[];
    valueToSet: O.Path<T, S.Split<P, '.'>>;
}

export interface RenderedTypedImmutableAttrSetter<T extends { [p: string]: any }, P extends string> {
    renderedAttrKeyPathParts: string[];
    valueToSet: ImmutableCast<O.Path<T, S.Split<P, '.'>>>;
}