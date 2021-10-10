import * as _ from 'lodash';
import * as immutable from "immutable";
import {resolveResultOrCallbackResult} from "./utils/executors";


export interface PrimitiveRestrainedFieldModelProps {
    required?: boolean;
}

export interface ComplexBaseFieldModelProps extends PrimitiveRestrainedFieldModelProps {
    useEmptyAsDefault?: boolean;
}

export interface BaseFieldModelProps extends PrimitiveRestrainedFieldModelProps {
    customDefaultValue?: any | (() => any);
}

export class BaseFieldModel {
    constructor(public readonly props: BaseFieldModelProps) {
    }

    /*makeDefault() {
        return undefined;
    }*/
}


export interface TypedDictProps extends ComplexBaseFieldModelProps {
    keyType: string;
    keyName: string;
    itemType: MapModel | "__ACTIVE_SELF_DICT__";
}

export class TypedDictFieldModel extends BaseFieldModel {
    constructor(props: TypedDictProps) {
        super({...props, customDefaultValue: props.useEmptyAsDefault === true ? () => immutable.Map() : undefined});
    }
}


export interface MapModelProps extends BaseFieldModelProps {
    fields: { [fieldName: string]: BaseFieldModel | TypedDictFieldModel | MapModel };
}

export class MapModel {
    constructor(public readonly props: MapModelProps) {
    }

    makeDefault() {
        // todo: remove this function ?
        return _.transform(this.props.fields, (result: { [key: string]: any }, fieldItem, fieldKey: string) => {
            result[fieldKey] = resolveResultOrCallbackResult(fieldItem.props.customDefaultValue);
        }, {});
    }
}


export class SetFieldModel extends BaseFieldModel {
    constructor(public readonly props: ComplexBaseFieldModelProps) {
        super({...props, customDefaultValue: props.useEmptyAsDefault === true ? () => immutable.Set([]) : undefined});
    }
}