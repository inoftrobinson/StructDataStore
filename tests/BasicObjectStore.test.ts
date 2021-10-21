import * as immutable from "immutable";
import {BasicObjectStore, BasicFieldModel, MapModel, BasicItemsObjectStore, SectionedItemsObjectStore} from "../src";

export type StoreFactory = <T>(itemModel: MapModel) => BasicItemsObjectStore<T> | SectionedItemsObjectStore<T>;

function basicObjectStoreFactory<T>(objectModel: MapModel): BasicObjectStore<T> {
    return new BasicObjectStore<StoreModel>({
        retrieveDataCallable: () => Promise.resolve({success: true, data: {}}), objectModel
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
        /*
        {
            'container1.field1'?: string,
            'container1.field2'?: string,
            'container2.field1'?: string,
        } | undefined
         */

        const oldFieldsValues = await store.updateMultipleAttrs({
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
        store.subscribeMultipleAttrs(
            ['container1.field1', 'container1.field2', 'container2.field1'],
            () => {
                listenersTriggersCounter += 1;
            }
        );
        await store.updateMultipleAttrs({
            'container1.field1': "c1.f1.alteration2",
            'container1.field2': "c1.f2.alteration2",
            'container2.field1': "c2.f1.alteration2",
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
        store.subscribeToAttr('container1.field1',() => {
            listenersTriggersCounter += 1;
        });
        store.subscribeToAttr('container1.field2',() => {
            listenersTriggersCounter += 1;
        });
        store.subscribeToAttr('container2.field1',() => {
            listenersTriggersCounter += 1;
        });
        await store.updateMultipleAttrs({
            'container1.field1': "c1.f1.alteration2",
            'container1.field2': "c1.f2.alteration2",
            'container2.field1': "c2.f1.alteration2",
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
});