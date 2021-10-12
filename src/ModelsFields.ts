import * as _ from 'lodash';
import * as immutable from "immutable";
import {resolveResultOrCallbackResult} from "./utils/executors";


export interface PrimitiveRestrainedFieldModelProps {
    required?: boolean;
}

export interface ComplexBasicFieldModelProps extends PrimitiveRestrainedFieldModelProps {
    useEmptyAsDefault?: boolean;
}

export class BaseFieldModel<P extends PrimitiveRestrainedFieldModelProps> {
    constructor(public readonly props: P) {
    }
}

export interface BasicFieldModelProps extends PrimitiveRestrainedFieldModelProps {
    customDefaultValue?: any | (() => any);
}

export class BasicFieldModel extends BaseFieldModel<BasicFieldModelProps> {
    constructor(props: BasicFieldModelProps) {
        super(props);
    }
}


export interface TypedDictProps extends ComplexBasicFieldModelProps {
    keyType: string;
    keyName: string;
    itemType: MapModel | "__ACTIVE_SELF_DICT__";
}

export class TypedDictFieldModel extends BaseFieldModel<TypedDictProps & BasicFieldModelProps> {
    constructor(props: TypedDictProps) {
        super({...props, customDefaultValue: props.useEmptyAsDefault === true ? () => immutable.Map() : undefined});
    }
}


export interface MapModelProps extends BasicFieldModelProps {
    fields: { [fieldName: string]: BasicFieldModel | TypedDictFieldModel | MapModel };
}

export class MapModel {
    constructor(public readonly props: MapModelProps) {
    }

    /*makeDefault() {
        // todo: remove this function ?
        return _.transform(this.props.fields, (result: { [key: string]: any }, fieldItem, fieldKey: string) => {
            result[fieldKey] = resolveResultOrCallbackResult(fieldItem.props.customDefaultValue);
        }, {});
    }*/
}


export class SetFieldModel extends BasicFieldModel {
    constructor(public readonly props: ComplexBasicFieldModelProps) {
        super({...props, customDefaultValue: props.useEmptyAsDefault === true ? () => immutable.Set([]) : undefined});
    }
}