import * as _ from 'lodash';
import * as immutable from "immutable";
import {resolveResultOrCallbackResult} from "./utils/executors";


export interface PrimitiveRestrainedFieldModelProps {
    required?: boolean;
}

export interface ComplexBasicFieldModelProps extends PrimitiveRestrainedFieldModelProps {
    useEmptyAsDefault?: boolean;
}

export abstract class BaseFieldModel<P extends PrimitiveRestrainedFieldModelProps> {
    private _parent?: BaseFieldModel<any>;

    protected constructor(public readonly props: P) {
    }

    get parent(): BaseFieldModel<any> | undefined {
        return this._parent;
    }

    register<P extends BaseFieldModel<any>>(parent: P | undefined) {
        this._parent = parent;
    }

    abstract dataLoader(fieldData: any): any;

    abstract makeDefault(): any;
}


export interface BasicFieldModelProps extends PrimitiveRestrainedFieldModelProps {
    customDefaultValue?: any | (() => any);
}

export class BasicFieldModel extends BaseFieldModel<BasicFieldModelProps> {
    constructor(props: BasicFieldModelProps) {
        super(props);
    }

    dataLoader(fieldData: any): any {
        return immutable.fromJS(fieldData);
    }

    makeDefault(): undefined {
        return undefined;
    }
}

export class SetFieldModel extends BasicFieldModel {
    constructor(public readonly props: ComplexBasicFieldModelProps) {
        super({...props, customDefaultValue: props.useEmptyAsDefault === true ? () => immutable.Set([]) : undefined});
    }

    dataLoader(fieldData: any): any {
        // We have support for both the Set object, which is what we would expect from a standard
        // updateDataToAttr from the client, but we also have support the items being in an Array,
        // which is what will happen when the items of a set are parsed from json.
        const safeEntries: any[] = (
            _.isSet(fieldData) ? Array.from(fieldData.values()) : (
                _.isArray(fieldData) ? fieldData : []
            )
        );
        return immutable.Set(safeEntries);
    }
}



export abstract class ContainerFieldModel<T> extends BaseFieldModel<T & BasicFieldModelProps> {
    protected constructor(props: any) {
        super(props);
    }

    get type(): string {
        const constructor = this.constructor as any;
        return constructor['TYPE'];
    }

    abstract navigateToAttrModel(attrKeyPathParts: string[]): any | null;
}

export interface MapModelProps extends BasicFieldModelProps {
    fields: { [fieldName: string]: BasicFieldModel | TypedDictFieldModel | MapModel };
}

export class MapModel extends ContainerFieldModel<MapModelProps> {
    public static readonly TYPE = 'MapField';
    // todo: rename to RecordModel

    constructor(public readonly props: MapModelProps) {
        super({...props, customDefaultValue: props.required === true ? () => this.makeDefault() : undefined});
    }

    register<P extends BaseFieldModel<any>>(parent: P) {
        super.register(parent);
        _.forEach(this.props.fields, (childField: BaseFieldModel<any>) => {
            childField.register<this>(this);
        });
    }

    navigateToAttrModel(attrKeyPathParts: string[]) {
        if (attrKeyPathParts.length > 0) {
            const fieldMatchingFirstPathPart: any | undefined = this.props.fields[attrKeyPathParts[0]];
            if (fieldMatchingFirstPathPart !== undefined) {
                return [fieldMatchingFirstPathPart, attrKeyPathParts.slice(1)];
            } else {
                return [null, attrKeyPathParts];
            }
        }
        return [this, attrKeyPathParts];
    }

    makeDefault() {
        return this.dataLoader(_.mapValues(this.props.fields, (fieldItem) => resolveResultOrCallbackResult(fieldItem.props.customDefaultValue)));
        /*return immutable.Record(_.transform(this.props.fields, (result: { [key: string]: any }, fieldItem, fieldKey: string) => {
            result[fieldKey] = resolveResultOrCallbackResult(fieldItem.props.customDefaultValue);
        }, {}));*/
    }

    dataLoader(fieldData: { [childFieldKey: string]: any } | null): any {
        if (fieldData != null) {
            const recordDefaultValues: { [fieldKey: string]: any } = {};
            const recordValues: { [fieldKey: string]: any } = {};

            for (let fieldKey in this.props.fields) {
                const fieldItem: BaseFieldModel<any> = this.props.fields[fieldKey];
                const matchingItemData: any | undefined = fieldData[fieldKey];
                if (matchingItemData === undefined) {
                    if (fieldItem.props.required !== true) {
                        recordValues[fieldKey] = (fieldItem.props.customDefaultValue !== undefined ?
                                resolveResultOrCallbackResult(fieldItem.props.customDefaultValue) : undefined
                        );
                    } else {
                        console.log(`Missing ${fieldKey}. Breaks all and returning undefined.`);
                        return undefined;
                    }
                } else {
                    recordValues[fieldKey] = fieldItem.dataLoader(matchingItemData);
                }
                recordDefaultValues[fieldKey] = resolveResultOrCallbackResult(fieldItem.props.customDefaultValue);
            }
            // const recordDefaultValues = _.mapValues(recordValues, () => undefined);
            // We set the defaultValues to a map of undefined values for all the keys in our recordValues. This is crucial, as this allows
            // the deletion and removal of fields. Otherwise, the default values would be restored when the fields are deleted/removed.

            const recordFactory: immutable.Record.Factory<any> = immutable.Record<any>(recordDefaultValues);
            // The default values are used to create a record factory.
            return recordFactory(recordValues as Partial<any>);
        } else {
            return undefined;
        }
    }
}

export interface TypedDictProps extends ComplexBasicFieldModelProps {
    keyType: string;
    keyName: string;
    itemType: BaseFieldModel<any> | "__ACTIVE_SELF_DICT__";
}

export class TypedDictFieldModel extends ContainerFieldModel<TypedDictProps> {
    public static readonly TYPE = 'TypedDictField';

    constructor(props: TypedDictProps & BasicFieldModelProps) {
        super({...props, customDefaultValue: props.useEmptyAsDefault === true ? () => immutable.Map() : undefined});
    }

    register<P extends BaseFieldModel<any>>(parent: P) {
        super.register(parent);
        if (this.props.itemType instanceof BaseFieldModel) {
            this.props.itemType.register<this>(this);
        }
    }

    navigateToAttrModel(attrKeyPathParts: string[]) {
        if (attrKeyPathParts.length > 0) {
            return [this.props.itemType, attrKeyPathParts.slice(1)];
        }
        return [this, attrKeyPathParts];
    }

    makeDefault(): immutable.Map<string, any> {
        return immutable.Map({});
    }

    dataLoader(fieldData: any): immutable.Map<string, any> {
        const itemTypeCallable = this.props.itemType === '__ACTIVE_SELF_DICT__' ? this.parent : this.props.itemType;
        return immutable.Map(_.transform(fieldData, (result: { [p: string]: any }, dictItem: any, dictKey: string) => {
            result[dictKey] = itemTypeCallable.dataLoader(dictItem);
        }, {}));
    }
}