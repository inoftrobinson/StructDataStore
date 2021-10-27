import * as immutable from "immutable";
import {
    BasicObjectStore,
    BasicFieldModel,
    MapModel,
    BasicItemsObjectStore,
    SectionedItemsObjectStore,
    TypedDictFieldModel
} from "../../src";

export type StoreFactory = <T>(itemModel: MapModel) => BasicItemsObjectStore<T> | SectionedItemsObjectStore<T>;

function basicObjectStoreFactory<T>(objectModel: MapModel): BasicObjectStore<T> {
    return new BasicObjectStore<T>({
        retrieveDataCallable: () => Promise.resolve({success: true, data: {} as T}), objectModel
    });
}

describe('BasicObjectStore', () => {
    test('simple getAttr', async () => {
        interface StoreModel {
            container1: {
                field1: number;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({})
                }})
            }})
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
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
            }})
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"},
        });
        const retrievedFieldsValues: {} = await store.getMultipleAttrs({
            'getter1': {attrKeyPath: 'container1.field1'},
            'getter2': {attrKeyPath: 'container1.field2'},
            'getter3': {attrKeyPath: 'container2.field1'}
        });
        expect(retrievedFieldsValues).toEqual({
            'getter1': "c1.f1",
            'getter2': "c1.f2",
            'getter3': "c2.f1",
        });
    });

    test('simple updateAttr', async () => {
        interface StoreModel {
            container1: {
                field1: string;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({})
                }})
            }})
        );
        store.loadFromData({'container1': {'field1': "c1.f1.alteration1"}});

        const oldValue: string | undefined = await store.updateAttr({
            attrKeyPath: 'container1.field1', valueToSet: "c1.f1.alteration2"
        });
        expect(oldValue).toEqual("c1.f1.alteration1");

        const retrievedNewValue: string | undefined = await store.getAttr('container1.field1');
        expect(retrievedNewValue).toEqual("c1.f1.alteration2");
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
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
            }})
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1.alteration1", 'field2': "c1.f2.alteration1"},
            'container2': {'field1': "c2.f1.alteration1", 'field2': "c2.f2.alteration1"},
        });

        const oldFieldsValues = await store.updateMultipleAttrs({
            'setter1': {attrKeyPath: 'container1.field1', valueToSet: "c1.f1.alteration2"},
            'setter2': {attrKeyPath: 'container1.field2', valueToSet: "c1.f2.alteration2"},
            'setter3': {attrKeyPath: 'container2.field1', valueToSet: "c2.f1.alteration2"}
        });
        expect(oldFieldsValues).toEqual({
            'setter1': "c1.f1.alteration1",
            'setter2': "c1.f2.alteration1",
            'setter3': "c2.f1.alteration1",
        });

        const retrievedFieldsValuesAfterUpdate: {
            'getter1': string | undefined,
            'getter2': string | undefined,
            'getter3': string | undefined,
            'getter4': string | undefined,
        } = await store.getMultipleAttrs({
            'getter1': {attrKeyPath: 'container1.field1'},
            'getter2': {attrKeyPath: 'container1.field2'},
            'getter3': {attrKeyPath: 'container2.field1'},
            'getter4': {attrKeyPath: 'container2.field2'}
        });
        expect(retrievedFieldsValuesAfterUpdate).toEqual({
            'getter1': "c1.f1.alteration2",
            'getter2': "c1.f2.alteration2",
            'getter3': "c2.f1.alteration2",
            'getter4': "c2.f2.alteration1",
        });
    });

    test('simple deleteAttr', async () => {
        interface StoreModel {
            container1: {
                field1: string;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({})
                }})
            }})
        );
        store.loadFromData({'container1': {'field1': "c1.f1"}});

        const retrievedValueBeforeDeletion: string | undefined = await store.getAttr('container1.field1');
        expect(retrievedValueBeforeDeletion).toEqual("c1.f1");

        await store.deleteAttr('container1.field1');
        const retrievedValueAfterDeletion: string | undefined = await store.getAttr('container1.field1');
        expect(retrievedValueAfterDeletion).toEqual(undefined);
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
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
            }})
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"},
        });
        await store.deleteMultipleAttrs([
            {attrKeyPath: 'container1.field1'},
            {attrKeyPath: 'container1.field2'},
            {attrKeyPath: 'container2.field1'}
        ]);

        const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs({
            'getter1': {attrKeyPath: 'container1.field1'},
            'getter2': {attrKeyPath: 'container1.field2'},
            'getter3': {attrKeyPath: 'container2.field1'},
            'getter4': {attrKeyPath: 'container2.field2'}
        });
        expect(retrievedFieldsValuesAfterUpdate).toEqual({
            'getter1': undefined,
            'getter12': undefined,
            'getter3': undefined,
            'getter4': "c2.f2",
        });
    });

    test('simple removeAttr', async () => {
        interface StoreModel {
            container1: {
                field1: string;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({})
                }})
            }})
        );
        store.loadFromData({'container1': {'field1': "c1.f1"}});

        const retrievedValueBeforeRemoval: string | undefined = await store.getAttr('container1.field1');
        expect(retrievedValueBeforeRemoval).toEqual("c1.f1");

        const removedValue: string | undefined = await store.removeAttr('container1.field1');
        expect(removedValue).toEqual("c1.f1");

        const retrievedValueAfterRemoval: string | undefined = await store.getAttr('container1.field1');
        expect(retrievedValueAfterRemoval).toEqual(undefined);
    });

    test('simple removeMultipleAttrs', async () => {
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
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({})
                }}),
            }})
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"},
        });
        await store.deleteMultipleAttrs([
            {attrKeyPath: 'container1.field1'},
            {attrKeyPath: 'container1.field2'},
            {attrKeyPath: 'container2.field1'}
        ]);

        const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs({
            'getter1': {attrKeyPath: 'container1.field1'},
            'getter2': {attrKeyPath: 'container1.field2'},
            'getter3': {attrKeyPath: 'container2.field1'},
            'getter4': {attrKeyPath: 'container2.field2'}
        });
        expect(retrievedFieldsValuesAfterUpdate).toEqual({
            'getter1': undefined,
            'getter2': undefined,
            'getter3': undefined,
            'getter4': "c2.f2",
        });
    });

    test('listeners sharing', async () => {
        interface StoreModel {
            container1: {
                field1: string;
                field2: string;
            },
            container2: {
                field1: string;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({}),
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                }})
            }})
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1.alteration1", 'field2': "c1.f2.alteration1"},
            'container2': {'field1': "c2.f1.alteration1"}
        });

        let listenersTriggersCounter: number = 0;
        store.subscribeMultipleAttrs([
            {attrKeyPath: 'container1.field1'},
            {attrKeyPath: 'container1.field2'},
            {attrKeyPath: 'container2.field1'}
        ],() => {
            listenersTriggersCounter += 1;
        });
        await store.updateMultipleAttrs({
            'setter1': {attrKeyPath: 'container1.field1', valueToSet: "c1.f1.alteration2"},
            'setter2': {attrKeyPath: 'container1.field2', valueToSet: "c1.f2.alteration2"},
            'setter3': {attrKeyPath: 'container2.field1', valueToSet: "c2.f1.alteration2"},
        });
        expect(listenersTriggersCounter).toEqual(1);
    });

    test('listeners separation', async () => {
        interface StoreModel {
            container1: {
                field1: string;
                field2: string;
            },
            container2: {
                field1: string;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                    'field2': new BasicFieldModel({}),
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                }})
            }})
        );
        store.loadFromData({
            'container1': {'field1': "c1.f1.alteration1", 'field2': "c1.f2.alteration1"},
            'container2': {'field1': "c2.f1.alteration1"}
        });

        let listenersTriggersCounter: number = 0;
        store.subscribeToAttr({
            attrKeyPath: 'container1.field1', callback: () => {
                listenersTriggersCounter += 1;
            }
        );
        store.subscribeToAttr({
            attrKeyPath: 'container1.field2', callback: () => {
                listenersTriggersCounter += 1;
            }
        );
        store.subscribeToAttr({
            attrKeyPath: 'container2.field1', callback: () => {
                listenersTriggersCounter += 1;
            }
        );
        await store.updateMultipleAttrs({
            'setter1': {attrKeyPath: 'container1.field1', valueToSet: "c1.f1.alteration2"},
            'setter2': {attrKeyPath: 'container1.field2', valueToSet: "c1.f2.alteration2"},
            'setter3': {attrKeyPath: 'container2.field1', valueToSet: "c2.f1.alteration2"},
        });
        expect(listenersTriggersCounter).toEqual(3);
    });

    test('simple updateDataToAttr', async () => {
        interface StoreModel {
            container1: {
                field1: string;
            },
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                }}),
            }})
        );

        await store.updateDataToAttr({attrKeyPath: 'container1', valueToSet: {'field1': "c1.f1"}});
        const retrievedContainer1: immutable.RecordOf<{ field1: string }> | undefined = await store.getAttr('container1');
        expect(retrievedContainer1?.toJS()).toEqual({'field1': "c1.f1"});
    });

    test('simple updateDataToMultipleAttrs', async () => {
        interface StoreModel {
            container1: {
                field2: string;
            },
            container2: {
                field1: string;
            }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                }}),
                'container2': new MapModel({fields: {
                    'field1': new BasicFieldModel({}),
                }}),
            }})
        );

        await store.updateDataToMultipleAttrs({
            'setter1': {attrKeyPath: 'container1.field1', valueToSet: "c1.f1"},
            'setter2': {attrKeyPath: 'container2.field1', valueToSet: "c2.f1"}
        });
        const retrievedContainers: {
            getter1: immutable.RecordOf<{field1: string}> | undefined,
            getter2: immutable.RecordOf<{field1: string}> | undefined,
        } = await store.getMultipleAttrs({
            'getter1': {attrKeyPath: 'container1'},
            'getter2': {attrKeyPath: 'container2'}
        });
        expect(retrievedContainers.getter1?.toJS()).toEqual({'field1': "c1.f1"});
        expect(retrievedContainers.getter2?.toJS()).toEqual({'field1': "c2.f1"});
    });

    test('typedDict updateDataToAttr', async () => {
        interface StoreModel {
            items: { [itemKey: string]: string }
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'items': new TypedDictFieldModel({
                    keyName: 'itemKey', keyType: 'string',
                    itemType: new BasicFieldModel({})
                }),
            }})
        );
        store.loadFromData({items: {}});

        await store.updateDataToAttr({attrKeyPath: 'items.item42A', valueToSet: "i1.i42A"});
        const retrievedItem: any | undefined = await store.getAttr('items.item42A');
        expect(retrievedItem).toEqual("i1.i42A");
    });

    test('typedDict updateDataToMultipleAttrs', async () => {
        interface StoreModel {
            items: { [itemKey: string]: string },
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({
                fields: {
                    'items': new TypedDictFieldModel({
                        keyName: 'itemKey', keyType: 'string',
                        itemType: new BasicFieldModel({})
                    }),
                }
            })
        );
        store.loadFromData({items: {}});

        await store.updateDataToMultipleAttrs({
            'setter1': {
                attrKeyPath: 'items.{{itemKey}}',
                queryKwargs: {'itemKey': "item42A"},
                valueToSet: "i1.i42A"
            },
            'setter2': {
                attrKeyPath: 'items.{{itemKey}}',
                queryKwargs: {'itemKey': "item42B"},
                valueToSet: "i2.i42B"
            }
        });
        const retrievedItems: {
            'getter1': string | undefined,
            'getter2': string | undefined,
        } = await store.getMultipleAttrs({
            'getter1': {
                attrKeyPath: 'items.{{itemKey}}',
                queryKwargs: {'itemKey': "item42A"}
            },
            'getter2': {
                attrKeyPath: 'items.{{itemKey}}',
                queryKwargs: {'itemKey': "item42B"}
            }
        });
        expect(retrievedItems).toEqual({
            'getter1': "i1.i42A",
            'getter2': "i2.i42B"
        });
    });
});