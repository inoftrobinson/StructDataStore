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
        retrieveDataCallable: () => Promise.resolve({success: true, data: {}}), objectModel
    });
}

describe('KeyPathsWithQueryKwargs', () => {
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

        const oldValue: string | undefined = await store.updateAttr('container1.field1', "c1.f1.alteration2");
        expect(oldValue).toEqual("c1.f1.alteration1");

        const retrievedNewValue: string | undefined = await store.getAttr('container1.field1');
        expect(retrievedNewValue).toEqual("c1.f1.alteration2");
    });

    test('getMultipleAttrs & updateMultipleAttrs', async () => {
        interface StoreModel {
            items: { [itemKey: string]: {
                field1: number;
                field2: number;
            } };
        }
        const store = basicObjectStoreFactory<StoreModel>(
            new MapModel({fields: {
                'items': new TypedDictFieldModel({
                    keyName: 'itemKey', keyType: 'string',
                    itemType: new MapModel({fields: {
                        'field1': new BasicFieldModel({}),
                        'field2': new BasicFieldModel({})
                    }}),
                })
            }})
        );
        store.loadFromData({'items': {
            'item1': {'field1': "i1.f1.alteration1", 'field2': "i1.f2.alteration1"},
            'item2': {'field1': "i2.f1.alteration1", 'field1': "i2.f2.alteration1"}
        }});

        const oldFieldsValues = await store.updateMultipleAttrs({
            'items.item1.field1': "i1.f1.alteration2",
            'items.item1.field2': "i1.f2.alteration2",
            'items.item2.field1': "i2.f1.alteration2"
        });
        expect(oldFieldsValues).toEqual({
            'items.item1.field1': "i1.f1.alteration1",
            'items.item1.field2': "i1.f2.alteration1",
            'items.item2.field1': "i2.f1.alteration1",
        });

        const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs([
            'items.item1.field1', 'items.item1.field2', 'items.item2.field1', 'items.item2.field2'
        ]);
        expect(retrievedFieldsValuesAfterUpdate).toEqual({
            'items.item1.field1': "c1.f1.alteration2",
            'items.item1.field2': "c1.f2.alteration2",
            'items.item2.field1': "c2.f1.alteration2",
            'items.item2.field2': "c2.f2.alteration1",
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

        await store.updateDataToAttr('container1', {'field1': "c1.f1"});
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
            'container1.field1': "c1.f1",
            'container2.field1': "c2.f1"
        });
        const retrievedContainers: {
            container1: immutable.RecordOf<{field1: string}> | undefined,
            container2: immutable.RecordOf<{field1: string}> | undefined,
        } = await store.getMultipleAttrs(['container1', 'container2']);
        expect(retrievedContainers.container1?.toJS()).toEqual({'field1': "c1.f1"});
        expect(retrievedContainers.container2?.toJS()).toEqual({'field1': "c2.f1"});
    });

    test('typedDict updateDataToAttr', async () => {
        interface StoreModel {
            items: { [itemKey: string]: string };
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

        await store.updateDataToAttr({
            attrKeyPath: 'items.{{itemKey}}',
            queryKwargs: {'itemKey': 'itemWithRestrictedChar..trailing'}
        }, "i1.i42A");
        const retrievedItem: any | undefined = await store.getAttr({
            attrKeyPath: 'items.{{itemKey}}',
            queryKwargs: {'itemKey': 'itemWithRestrictedChar..trailing'}
        });
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
            'items.item42A': "i1.i42A",
            'items.item42B': "i2.i42B"
        });
        const retrievedItems: {
            'items.item42A': string | undefined,
            'items.item42B': string | undefined,
        } = await store.getMultipleAttrs([
            'items.item42A',
            'items.item42B'
        ]);
        expect(retrievedItems).toEqual({
            'items.item42A': "i1.i42A",
            'items.item42B': "i2.i42B"
        });
    });
});