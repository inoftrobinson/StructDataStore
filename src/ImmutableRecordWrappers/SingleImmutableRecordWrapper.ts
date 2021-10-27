import {F, O, S, U} from 'ts-toolbelt';
import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "../DataProcessors";
import {MapModel} from "../ModelsFields";
import {
    navigateToAttrKeyPathIntoMapModel,
    navigateToAttrKeyPathIntoMapModelV2,
    navigateToAttrKeyPathPartsIntoMapModel
} from "../utils/fieldsNavigation";
import {
    separateAttrKeyPath,
    separateAttrKeyPathWithQueryKwargs,
    separatePotentialGetterWithQueryKwargs
} from "../utils/attrKeyPaths";
import {PrimitiveAttrGetter, TypedAttrGetter} from "../models";
import BaseImmutableRecordWrapper from "./BaseImmutableRecordWrapper";


export default class SingleImmutableRecordWrapper<T extends { [p: string]: any }> extends BaseImmutableRecordWrapper {
    constructor(
        public RECORD_DATA: immutable.RecordOf<T>,
        public readonly itemModel: MapModel
    ) {
        super();
    }

    static fromRecord<T extends {}>(itemModel: MapModel, record: immutable.RecordOf<T>) {
        return new SingleImmutableRecordWrapper<T>(record, itemModel);
    }

    static fromData<T extends {}>(itemModel: MapModel, data: T) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
        return new SingleImmutableRecordWrapper<T>(record, itemModel);
    }

    static fromEmpty<T extends {}>(itemModel: MapModel) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel({}, itemModel) as immutable.RecordOf<T>;
        return new SingleImmutableRecordWrapper<T>(record, itemModel);
    }

    /*static fromNull<T>() {
        return new SingleImmutableRecordWrapper<T>();
    }*/

    updateRecord(record: immutable.RecordOf<T>): immutable.RecordOf<T> {
        const oldRecordData = this.RECORD_DATA;
        this.RECORD_DATA = record;
        return oldRecordData;
    }

    updateRecordFromData(itemModel: MapModel, data: T): void {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
    }

    /*private safeNavigateIntoAttributeData(
        itemMapModel: MapModel, keyPathElements: string[],
        parentAttributeData: any, parentRecordData: immutable.RecordOf<T>
    ) {
        const firstKeyPathElement: string = keyPathElements[0];
        const matchingFieldItem: MapModel | BasicFieldModel | TypedDictFieldModel | undefined = itemMapModel.props.fields[firstKeyPathElement];
        if (matchingFieldItem === undefined) {
            console.warn(`No field model found for ${firstKeyPathElement}`);
            return [false, null, undefined];
        }
        if (matchingFieldItem instanceof MapModel) {
            const currentItemMapModel = matchingFieldItem;
            // todo: validate
            if (keyPathElements.length > 1) {
                return this.safeNavigateIntoAttributeData(matchingFieldItem, keyPathElements.slice(1),)
            }

        } else if (matchingFieldItem instanceof TypedDictFieldModel && matchingFieldItem.props.itemType instanceof MapModel) {
            currentItemMapModel = matchingFieldItem.props.itemType;

        } else {
            console.warn(`Field '${keyPathElement}' not valid`);
            return [ false, null, undefined ];
        }

        const existingAttributeValue: any | undefined = alteredRecordData.get(keyPathElement);
        lastAttributeValue = (
            existingAttributeValue !== undefined ? existingAttributeValue : (() => {
                const defaultValue = matchingFieldItem.makeDefault();
                alteredRecordData.set(keyPathElement, defaultValue);
                return defaultValue;
            }
        )());
    }

    private safeAlterRecordDataInPath(attrKeyPathElements: string[], immutableValue: any): [ boolean, immutable.RecordOf<T> | null, any ] {
        const alteredRecordData = this.RECORD_DATA;
        let currentItemMapModel: MapModel = this.itemModel;
        let lastAttributeValue: any = undefined;

        const attrKeyPathElementsToNavigateInto: string[] = attrKeyPathElements.slice(0, -1);
        for (let keyPathElement of attrKeyPathElementsToNavigateInto) {
            const matchingFieldItem: MapModel | BasicFieldModel | TypedDictFieldModel | undefined = currentItemMapModel.props.fields[keyPathElement];
            if (matchingFieldItem === undefined) {
                console.warn(`No field model found for ${keyPathElement}`);
                return [false, null, undefined];
            }
            if (matchingFieldItem instanceof MapModel) {
                currentItemMapModel = matchingFieldItem;
            } else if (matchingFieldItem instanceof TypedDictFieldModel && matchingFieldItem.props.itemType instanceof MapModel) {
                currentItemMapModel = matchingFieldItem.props.itemType;
            } else {
                console.warn(`Field '${keyPathElement}' not valid`);
            }

            const existingAttributeValue: any | undefined = alteredRecordData.get(keyPathElement);
            lastAttributeValue = (
                existingAttributeValue !== undefined ? existingAttributeValue : (() => {
                    const defaultValue = matchingFieldItem.makeDefault();
                    alteredRecordData.set(keyPathElement, defaultValue);
                    return defaultValue;
                }
            )());
        }

        const lastAttrKeyPathElement: string = attrKeyPathElements.slice(-1)[0];
        const oldLastAttributeValue = lastAttributeValue.get(lastAttrKeyPathElement);
        lastAttributeValue.set(lastAttrKeyPathElement, immutableValue);
        return [true, alteredRecordData, oldLastAttributeValue];
    }*/

    /*const [alterSuccess, alteredRecordData, oldAttributeValue] = this.safeAlterRecordDataInPath(attrKeyPathElements, immutableValue);*/

    // getAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): O.Path<T, S.Split<P, '.'>> {
    getAttr(renderedAttrKeyPathParts: string[]): any {
        return this.RECORD_DATA.getIn(renderedAttrKeyPathParts);
    }

    // getMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): U.Merge<O.P.Pick<T, S.Split<P, ".">>> {
    /*getMultipleAttrs(getters: (string | PrimitiveAttrGetter)[]): { [attrKeyPath: string]: any };
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
    }*/

    getMultipleAttrs(getters: { [getterKey: string]: string[] }): { [getterKey: string]: any } {
        const retrievedValues: { [getterKey: string]: any } = _.mapValues(
            getters, (getterRenderedAttrKeyPathParts: string[], getterKey: string) => {
                return this.RECORD_DATA.getIn(getterRenderedAttrKeyPathParts);
            }
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
    updateMultipleAttrs(setters: { [setterKey: string]: { renderedAttrKeyPathParts: string[], valueToSet: any } }): { [setterKey: string]: any | undefined } {
        const settersKeys: string[] = Object.keys(setters);
        if (!(settersKeys.length > 0)) {
            return {};
        }
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [setterKey: string]: any | undefined } = _.mapValues(
            setters, (setterItem: { renderedAttrKeyPathParts: string[], valueToSet: any }, setterKey: string) => {
                const immutableValue: any = immutable.fromJS(setterItem.valueToSet);
                const oldValue: any = this.RECORD_DATA.getIn(setterItem.renderedAttrKeyPathParts);

                // navigateToAttrKeyPathIntoMapModelV2(this.itemModel, currentAttrKeyPath, ());

                for (let i=0; i < setterItem.renderedAttrKeyPathParts.length - 1; i++) {
                    const currentPathElements: string[] = setterItem.renderedAttrKeyPathParts.slice(0, i+1);
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
                alteredRecordData = alteredRecordData.setIn(setterItem.renderedAttrKeyPathParts, immutableValue);
                return oldValue;
            }
        );
        this.RECORD_DATA = alteredRecordData;
        return oldValues;
    }

    // deleteAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): void {
    deleteAttr(renderedAttrKeyPathParts: string[]): void {
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(renderedAttrKeyPathParts);
    }

    // deleteMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): void {
    deleteMultipleAttrs(renderedAttrsKeyPathsParts: string[][]): void {
        if (!(renderedAttrsKeyPathsParts.length > 0)) {
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
        _.forEach(renderedAttrsKeyPathsParts, (renderedAttrKeyPathPartsItem: string[]) => {
            alteredRecordData = alteredRecordData.deleteIn(renderedAttrKeyPathPartsItem);
        });
        this.RECORD_DATA = alteredRecordData;
    }

    // removeAttr<P extends string>(attrKeyPath: F.AutoPath<T, P>): O.Path<T, S.Split<P, '.'>> | undefined {
    removeAttr(renderedAttrKeyPathParts: string[]): any | undefined {
        const oldValue: any = this.RECORD_DATA.getIn(renderedAttrKeyPathParts);
        this.RECORD_DATA = this.RECORD_DATA.deleteIn(renderedAttrKeyPathParts);
        return oldValue;
    }

    // removeMultipleAttrs<P extends string>(attrsKeyPaths: F.AutoPath<T, P>[]): U.Merge<O.P.Pick<T, S.Split<P, ".">>> | undefined {
    removeMultipleAttrs(removers: { [removerKey: string]: string[] }): any | undefined {
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [removerKey: string]: any | undefined } = _.transform(removers,
            (result: { [removerKey: string]: any | undefined }, setterRenderedAttrKeyPathParts: string[], setterKey: string) => {
                const oldValue: any = this.RECORD_DATA.getIn(setterRenderedAttrKeyPathParts);
                alteredRecordData = alteredRecordData.deleteIn(setterRenderedAttrKeyPathParts);
                result[setterKey] = oldValue;
            }
        );
        this.RECORD_DATA = alteredRecordData;
        return oldValues;
    }
}