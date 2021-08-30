import * as _ from 'lodash';
import * as immutable from 'immutable';
import {loadObjectDataToImmutableValuesWithFieldsModel} from "./DataProcessors";
import {MapModel} from "./ModelsFields";
import RecordSubscriptionsWrapper from "./RecordSubscriptionsWrapper";


export default class RecordDataWrapper<T> {
    constructor(
        public subscriptionsWrapper: RecordSubscriptionsWrapper<T>,
        public RECORD_DATA:immutable.RecordOf<T>
    ) {
    }

    static fromRecord<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>, record:immutable.RecordOf<T>) {
        return new RecordDataWrapper<T>(subscriptionsWrapper, record);
    }

    static fromData<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>, itemModel: MapModel, data: T) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
        return new RecordDataWrapper<T>(subscriptionsWrapper, record);
    }

    static fromEmpty<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>, itemModel: MapModel) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel({}, itemModel) as immutable.RecordOf<T>;
        return new RecordDataWrapper<T>(subscriptionsWrapper, record);
    }

    /*static fromNull<T>(subscriptionsWrapper: RecordSubscriptionsWrapper<T>) {
        return new RecordDataWrapper<T>(subscriptionsWrapper);
    }*/


    updateRecord(record:immutable.RecordOf<T> | null) {
        this.RECORD_DATA = record;
        this.subscriptionsWrapper.triggerAllSubscribers();
    }

    updateRecordFromData(itemModel: MapModel, data: T) {
        const record: immutable.RecordOf<T> = loadObjectDataToImmutableValuesWithFieldsModel(data, itemModel) as immutable.RecordOf<T>;
        return this.updateRecord(record);
    }

    updateAttr(attrKeyPath: string, value: any): any | undefined {
        const immutableValue: any = immutable.fromJS(value);
        const attrKeyPathElements: string[] = attrKeyPath.split('.');
        const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
        this.RECORD_DATA = this.RECORD_DATA.setIn(attrKeyPathElements, immutableValue);
        this.subscriptionsWrapper.triggerSubscribersForAttr(attrKeyPath);
        return oldValue;
    }

    updateMultipleAttrs<T extends { [attrKeyPath: string]: any }>(mutators: Partial<T>): IterableIterator<[keyof T, T[keyof T]]> {
        const mutatorsKeys: string[] = Object.keys(mutators);
        if (!(mutatorsKeys.length > 0)) {
            return {};
        }
        let alteredRecordData: immutable.RecordOf<T> = this.RECORD_DATA;
        const oldValues: { [attrKeyPath: string]: any | undefined } = _.mapValues(mutators, (value: any, attrKeyPath: string) => {
            const immutableValue: any = immutable.fromJS(value);
            const attrKeyPathElements: string[] = attrKeyPath.split('.');
            const oldValue: any = this.RECORD_DATA.getIn(attrKeyPathElements);
            alteredRecordData = alteredRecordData.setIn(attrKeyPathElements, immutableValue);
            return oldValue;
        });
        this.RECORD_DATA = alteredRecordData;
        this.subscriptionsWrapper.triggerSubscribersForMultipleAttrs(mutatorsKeys);
        return oldValues;
    }
}