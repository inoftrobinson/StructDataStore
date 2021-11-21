import * as immutable from "immutable";
import {
    BasicObjectStore,
    BasicFieldModel,
    MapModel,
    ImmutableCast
} from "../src";

function basicObjectStoreFactory<T>(objectModel: MapModel): BasicObjectStore<T> {
    return new BasicObjectStore<T>({
        retrieveDataCallable: () => Promise.resolve({success: true, data: {} as T}), objectModel
    });
}

describe('RequiredFields', () => {
    test('non-required MapModel', async () => {
        interface StoreModel {
            container1?: {
                field1: string;
                field2: string;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({required: false, fields: {
                    'field1': new BasicFieldModel({required: true}),
                    'field2': new BasicFieldModel({required: true, customDefaultValue: "c1.f2.default"})
                }})
            }})
        );

        store.loadFromData({});
        const retrievedEmptyData: ImmutableCast<StoreModel> | null = await store.getRecordData();
        expect(retrievedEmptyData?.toJS()).toEqual({});

        store.loadFromData({'container1': {'field1': "c1.f1.alter1", 'field2': undefined}});
        const retrievedData: ImmutableCast<StoreModel> | null = await store.getRecordData();
        console.log(retrievedData?.toJS(), {'container1': {'field1': "c1.f1.alter1", 'field2': "c1.f2.default"}});

        store.loadFromData({'container1': undefined});
        await store.updateAttr({attrKeyPath: 'container1.field1', valueToSet: "c1.f1.alter1"});
        const retrievedUnspecifiedField2 = await store.getAttr('container1.field2');
        expect(retrievedUnspecifiedField2).toEqual("c1.f2.default");

        await store.updateAttr({attrKeyPath: 'container1.field2', valueToSet: "c1.f2.alter1"});
        const retrievedContainerFields = await store.getMultipleAttrs({
            'field1': {attrKeyPath: 'container1.field1'},
            'field2': {attrKeyPath: 'container1.field2'},
        });
        expect(retrievedContainerFields).toEqual({
            'field1': "c1.f1.alter1",
            'field2': "c1.f2.alter1"
        });
    });
});