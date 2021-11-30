import * as immutable from "immutable";
import {
    BasicItemsObjectStore,
    SectionedItemsObjectStore,
    BasicFieldModel,
    MapModel,
    TypedDictFieldModel, ImmutableCast
} from "../../../src";


export type StoreFactory = <T>(itemModel: MapModel) => BasicItemsObjectStore<T> | SectionedItemsObjectStore<T>;

export async function typedDictActiveSelfDict(storeFactory: StoreFactory) {
    interface ParameterItem {
        value: any;
        childParameters: { [childParameterKey: string]: ParameterItem };
    }
    interface StoreItemModel {
        parameters: { [parameterKey: string]: ParameterItem };
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'parameters': new TypedDictFieldModel({
                keyType: "string", keyName: "parameterKey",
                required: false, useEmptyAsDefault: true,
                itemType: new MapModel({fields: {
                    childParameters: new TypedDictFieldModel({
                        keyType: "str", keyName: "childParameterKey",
                        itemType: '__ACTIVE_SELF_DICT__',
                        required: false, useEmptyAsDefault: true
                    }),
                    value: new BasicFieldModel({required: true})
                }})
            }),
        }})
    );
    const item1Data: ParameterItem = {
        'parameters': {
            'parameter1': {
                'value': "c1",
                'childParameters': {
                    'childParameter1': {
                        'value': "cp1",
                        'childParameters': {}
                    }
                }
            }
        }
    };
    store.loadFromData({
        'item1': item1Data
    });
    const retrievedItem1: ImmutableCast<ParameterItem> | undefined = await store.getAttr(
        '{{itemKey}}', {'itemKey': "item1"}
    );
    expect(retrievedItem1?.toJS()).toEqual(item1Data);
}