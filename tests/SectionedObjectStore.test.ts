import {BaseFieldModel, MapModel} from "../src/ModelsFields";
import SectionedObjectStore from "../src/Stores/ObjectStores/SectionedObjectStore";


describe('SectionedObjectStore', () => {
    test('simple getAttr', async () => {
        interface StoreModel {
            container1: {
                field1: number;
            }
        }
        const store = new SectionedObjectStore<StoreModel>({
            retrieveDataCallable: () => Promise.resolve(undefined),
            objectModel: new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BaseFieldModel({})
                }})
            }})}
        );
        store.loadFromData({'container1': {'field1': 42}});
        const retrievedField1Value: number | undefined = await store.getAttr('container1.field1');
        expect(retrievedField1Value).toEqual(42);
    });

    test('simple getMultipleAttrs', async () => {
        interface StoreModel {
            container1: {
                field1: string;
                field2: string;
            },
            container2: {
                field1: string;
                field2: string;
            }
        }
        const store = new SectionedObjectStore<StoreModel>({
            retrieveDataCallable: () => Promise.resolve(undefined),
            objectModel: new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BaseFieldModel({}),
                    'field2': new BaseFieldModel({})
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BaseFieldModel({}),
                    'field2': new BaseFieldModel({})
                }}),
            }})}
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"},
        });
        const retrievedFieldsValues: {} = await store.getMultipleAttrs([
            'container1.field1', 'container1.field2', 'container2.field1'
        ]);
        expect(retrievedFieldsValues).toEqual({
            'container1.field1': "c1.f1",
            'container1.field2': "c1.f2",
            'container2.field1': "c2.f1",
        });
    });

    test('simple updateAttr', async () => {

    });

    test('simple updateMultipleAttrs', async () => {
        interface StoreModel {
            container1: {
                field1: string;
                field2: string;
            },
            container2: {
                field1: string;
                field2: string;
            }
        }
        const store = new SectionedObjectStore<StoreModel>({
            retrieveDataCallable: () => Promise.resolve(undefined),
            objectModel: new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BaseFieldModel({}),
                    'field2': new BaseFieldModel({})
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BaseFieldModel({}),
                    'field2': new BaseFieldModel({})
                }}),
            }})}
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1.alteration1", 'field2': "c1.f2.alteration1"},
            'container2': {'field1': "c2.f1.alteration1", 'field2': "c2.f2.alteration1"},
        });
        const oldFieldsValues: {} = await store.updateMultipleAttrs({
            'container1.field1': "c1.f1.alteration2",
            'container1.field2': "c1.f2.alteration2",
            'container2.field1': "c2.f1.alteration2"
        });
        expect(oldFieldsValues).toEqual({
            'container1.field1': "c1.f1.alteration1",
            'container1.field2': "c1.f2.alteration1",
            'container2.field1': "c2.f1.alteration1",
        });

        const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs([
            'container1.field1', 'container1.field2', 'container2.field1', 'container2.field2'
        ]);
        expect(retrievedFieldsValuesAfterUpdate).toEqual({
            'container1.field1': "c1.f1.alteration2",
            'container1.field2': "c1.f2.alteration2",
            'container2.field1': "c2.f1.alteration2",
            'container2.field2': "c2.f2.alteration1",
        });
    });

    test('simple deleteAttr', async () => {

    });

    test('simple deleteMultipleAttrs', async () => {
        interface StoreModel {
            container1: {
                field1: string;
                field2: string;
            },
            container2: {
                field1: string;
                field2: string;
            }
        }
        const store = new SectionedObjectStore<StoreModel>({
            retrieveDataCallable: () => Promise.resolve(undefined),
            objectModel: new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BaseFieldModel({}),
                    'field2': new BaseFieldModel({})
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BaseFieldModel({}),
                    'field2': new BaseFieldModel({})
                }}),
            }})}
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"},
        });
        await store.deleteMultipleAttrs([
            'container1.field1', 'container1.field2', 'container2.field1'
        ]);

        const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs([
            'container1.field1', 'container1.field2', 'container2.field1', 'container2.field2'
        ]);
        expect(retrievedFieldsValuesAfterUpdate).toEqual({
            'container1.field1': undefined,
            'container1.field2': undefined,
            'container2.field1': undefined,
            'container2.field2': "c2.f2",
        });
    });

    test('simple removeAttr', async () => {

    });

    test('simple removeMultipleAttrs', async () => {

    });
});