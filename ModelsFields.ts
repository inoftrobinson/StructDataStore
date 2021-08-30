import * as _ from 'lodash';
import * as immutable from "immutable";
import {ACTIVE_SELF_DICT} from "./Serializers/smartSettersRemoversForRecursiveDifferences_new";


export interface BaseFieldModelProps {
    required?: boolean;
    customDefaultValue?: any;
}

export class BaseFieldModel {
    constructor(public readonly props: BaseFieldModelProps) {
    }

    makeDefault() {
        return undefined;
    }
}

export interface TypedDictProps extends BaseFieldModelProps {
    keyType: string;
    keyName: string;
    itemType: MapModel | "__ACTIVE_SELF_DICT__";
}

export class TypedDictFieldModel extends BaseFieldModel {
    constructor(public readonly props: TypedDictProps) {
        super(props);
    }

    makeDefault() {
        return this.props.required ? immutable.Map() : undefined;
    }
}

export interface MapModelProps extends BaseFieldModelProps {
    fields: { [fieldName: string]: BaseFieldModel | TypedDictFieldModel | MapModel };
}

export class MapModel {
    constructor(public readonly props: MapModelProps) {
    }

    makeDefault() {
        return _.transform(this.props.fields, (result: { [key: string]: any }, fieldItem, fieldKey: string) => {
            result[fieldKey] = fieldItem.makeDefault();
        }, {});
    }
}