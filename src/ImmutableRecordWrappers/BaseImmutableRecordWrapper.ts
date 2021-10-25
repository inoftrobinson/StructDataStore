import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {PrimitiveAttrGetter, TypedAttrGetter} from "../models";


export default abstract class BaseImmutableRecordWrapper {
    abstract getAttr(renderedAttrKeyPathParts: string[]): any;

    // getMultipleAttrs(getters: (string | PrimitiveAttrGetter)[]): { [attrKeyPath: string]: any };
    abstract getMultipleAttrs(getters: { [getterKey: string]: string | PrimitiveAttrGetter }): { [getterKey: string]: any };

    // updateAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>, value: any): O.Path<T, S.Split<P, '.'>> | undefined {
    abstract updateAttr(renderedAttrKeyPathParts: string[], value: any): any | undefined;

    abstract updateMultipleAttrs(mutators: { [attrKeyPath: string]: any }): { [attrKeyPath: string]: any | undefined };

    abstract deleteAttr(attrKeyPath: string): void;

    abstract deleteMultipleAttrs(attrsKeyPaths: string[]): void;

    abstract removeAttr(attrKeyPath: string): any | undefined;

    abstract removeMultipleAttrs(attrsKeyPaths: string[]): any | undefined;
}