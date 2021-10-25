import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../DataProcessors";
import {MapModel} from "../ModelsFields";
import {
    navigateToAttrKeyPathPartsIntoMapModel
} from "../utils/fieldsNavigation";
import {
    separateAttrKeyPath,
    separatePotentialGetterWithQueryKwargs
} from "../utils/attrKeyPaths";
import {PrimitiveAttrGetter, TypedAttrGetter} from "../models";
import SingleImmutableRecordWrapper from "./SingleImmutableRecordWrapper";
import BaseImmutableRecordWrapper from "./BaseImmutableRecordWrapper";


export default class MultipleImmutableRecordsWrapper<T extends { [p: string]: any }> extends BaseImmutableRecordWrapper {
    constructor(
        // public readonly getSingleRecordItem: (recordKey: string) => Promise<SingleImmutableRecordWrapper<T> | null>,
        // public readonly getMultipleRecordItems: (recordKeys: string[]) => Promise<{ [recordKey: string]: SingleImmutableRecordWrapper<T> | null }>,
        public readonly RECORDS: SingleImmutableRecordWrapper<T>
    ) {
        super();
    }

    private makeRelativeAttrKeyPath<P extends string>(renderedAttrKeyPathParts: string[]): {
        itemKey: string, relativeAttrKeyPathParts: string[] | null
    } {
        const relativeAttrKeyPathParts: F.AutoPath<T, P> | null = (
            attrKeyPathParts.length > 1 ? attrKeyPathParts.slice(1) : null
        );
        return {itemKey: attrKeyPathParts[0], relativeAttrKeyPathParts};
    }

    protected getMatchingRecordWrapper<P extends string>(renderedAttrKeyPathParts: string[]): (
        Promise<{ recordWrapper: SingleImmutableRecordWrapper<T> | null, relativeAttrKeyPathParts: string[] }>
    ) {
        const {itemKey, relativeAttrKeyPathParts} = this.makeRelativeAttrKeyPath<P>(renderedAttrKeyPathParts);
        const recordWrapper: SingleImmutableRecordWrapper<T> | null = await this.RECORDS[itemKey];
        return {recordWrapper, relativeAttrKeyPathParts};
    }

    // getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): O.Path<T, S.Split<P, '.'>> {
    getAttr(renderedAttrKeyPathParts: string[]): any {
        const {recordWrapper, relativeAttrKeyPath} = this.getMatchingRecordWrapper(renderedAttrKeyPathParts);
        return recordWrapper.getAttr(relativeAttrKeyPathParts);
    }

    // getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): U.Merge<O.P.Pick<T, S.Split<P, ".">>> {
    getMultipleAttrs(getters: (string | PrimitiveAttrGetter)[]): { [attrKeyPath: string]: any };
    getMultipleAttrs(getters: { [getterKey: string]: string | PrimitiveAttrGetter }): { [getterKey: string]: any } {
        const retrievedValues: { [p: string]: any } = (
            _.isArray(getters) ? _.transform(
                getters, (output: { [renderedAttrKeyPath: string]: any }, getterItem: string | PrimitiveAttrGetter) => {
                    const attrKeyPathElements: string[] = separatePotentialGetterWithQueryKwargs(getterItem);
                    const renderedAttrKeyPath: string = attrKeyPathElements.join('.');
                    output[renderedAttrKeyPath] = this.RECORD_DATA.getIn(attrKeyPathElements);
                }, {}
            ) : _.isPlainObject(getters) ? _.transform(
                getters, (output: { [getterKey: string]: any }, getterItem: string | PrimitiveAttrGetter, getterKey: string) => {
                    const attrKeyPathElements: string[] = separatePotentialGetterWithQueryKwargs(getterItem);
                    output[getterKey] = this.RECORD_DATA.getIn(attrKeyPathElements);
                }, {}
            ) : (() => {
                console.error('getters were not an array or an object, and could not be used.');
                console.error(getters);
                return {};
            })()
        );
        return retrievedValues;
    }

    // updateAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>, value: any): O.Path<T, S.Split<P, '.'>> | undefined {
    updateAttr(renderedAttrKeyPathParts: string[], value: any): any | undefined {
        const immutableValue: any = immutable.fromJS(value);
        const oldValue: any = this.RECORD_DATA.getIn(renderedAttrKeyPathParts);
        this.RECORD_DATA = this.RECORD_DATA.setIn(renderedAttrKeyPathParts, immutableValue);
        return oldValue;
    }

    // updateMultipleAttrs<T extends { [attrKeyPath: string]: any }>(mutators: Partial<T>): IterableIterator<[keyof T, T[keyof T]]> {
    updateMultipleAttrs(mutators: { [attrKeyPath: string]: any }): { [attrKeyPath: string]: any | undefined } {
        const relativeMutatorsByRecordsKeys

        const mutatorsKeys: string[] = Object.keys(mutators);
        if (!(mutatorsKeys.length > 0)) {
            return {};
        }
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [attrKeyPath: string]: any | undefined } = _.mapValues(mutators, (value: any, attrKeyPath: string) => {
            const immutableValue: any = immutable.fromJS(value);
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
            const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
            const rar = this.RECORD_DATA.toJS();

            // navigateToAttrKeyPathIntoMapModelV2(this.itemModel, currentAttrKeyPath, ());

            for (let i=0; i < attrKeyPathElements.length - 1; i++) {
                const currentPathElements: string[] = attrKeyPathElements.slice(0, i+1);
                const fieldModel = navigateToAttrKeyPathPartsIntoMapModel(this.itemModel, currentPathElements);
                if (fieldModel != null) {
                    const retrievedItem = alteredRecordData.getIn(currentPathElements);
                    if (retrievedItem === undefined) {
                        alteredRecordData = alteredRecordData.setIn(currentPathElements, fieldModel.makeDefault());
                        // todo: stop using customDefaultValue and use a factory (for list's, map's and record's ?)
                    }
                }
            }
            /*_.forEach(attrKeyPathElements.slice(0, -1), (attrKeyPathPart: string, index: number) => {
                const parts = attrKeyPathElements.slice(0, index + 1);
                navigateToAttrKeyPathIntoMapModelV2(this.itemModel, )
                const item = alteredRecordData.getIn()
            });*/
            alteredRecordData = alteredRecordData.setIn(attrKeyPathElements, immutableValue);
            return oldValue;
        });
        this.RECORD_DATA = alteredRecordData;
        return oldValues;
    }

    // deleteAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): void {
    deleteAttr(attrKeyPath: string): void {
        const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
    }

    // deleteMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): void {
    deleteMultipleAttrs(attrsKeyPaths: string[]): void {
        if (!(attrsKeyPaths.length > 0)) {
            return;
        }
        /*
        // todo: move to a mergeDeep of mutators instead of the repeated call to deleteIn
        map.mergeDeep
        const mutators = _.transform(attrsKeyPaths, (result: {}, attrKeyPath: F.AutoPath<T, P>) => {
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
            result[attrKeyPath] = undefined;
            let container = result;
            _.forEach(attrKeyPathElements, (attrKeyPathPart: string) => {
                const existingSubContainer: {} | undefined = container[attrKeyPathPart];
                if (existingSubContainer === undefined) {
                    const newSubContainer = {};
                    container[attrKeyPathPart] = newSubContainer;
                    container = newSubContainer;
                } else {
                    container = existingSubContainer;
                }
            });
        }, {});
         */
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        _.forEach(attrsKeyPaths, (attrKeyPath: string) => {
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
            alteredRecordData = alteredRecordData.deleteIn(attrKeyPathElements);
        });
        this.RECORD_DATA = alteredRecordData;
    }

    // removeAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): O.Path<T, S.Split<P, '.'>> | undefined {
    removeAttr(attrKeyPath: string): any | undefined {
        const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(attrKeyPathElements);
        return oldValue;
    }

    // removeMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): U.Merge<O.P.Pick<T, S.Split<P, ".">>> | undefined {
    removeMultipleAttrs(attrsKeyPaths: string[]): any | undefined {
        if (!(attrsKeyPaths.length > 0)) {
            return {};
        }
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [attrKeyPath: string]: any | undefined } = _.transform(attrsKeyPaths, (result: {}, attrKeyPath: string) => {
            const attrKeyPathElements: string[] = separateAttrKeyPath(attrKeyPath);
            const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
            alteredRecordData = alteredRecordData.deleteIn(attrKeyPathElements);
            return oldValue;
        });
        this.RECORD_DATA = alteredRecordData;
        return oldValues;
    }
}