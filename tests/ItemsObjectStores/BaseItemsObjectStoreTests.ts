import {BasicFieldModel, MapModel} from "../../src/ModelsFields";
import BasicItemsObjectStore from "../../src/Stores/ObjectStores/ItemsObjectStores/BasicItemsObjectStore";
import SectionedItemsObjectStore from "../../src/Stores/ObjectStores/ItemsObjectStores/SectionedItemsObjectStore";
import * as Immutable from "immutable";


// export default (storeClass: typeof BasicItemsObjectStore | typeof SectionedItemsObjectStore) => {
//     describe('BaseItemsObjectStore', () => {
export type StoreFactory = <T>(itemModel: MapModel) => BasicItemsObjectStore<T> | SectionedItemsObjectStore<T>;

export async function simpleGetAttr(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: number;
        }
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'container1': new MapModel({fields: {
                'field1': new BasicFieldModel({})
            }})
        }})
    );
    store.loadFromData({'item1': {'container1': {'field1': 42}}});
    const retrievedField1Value: number | undefined = await store.getAttr('item1.container1.field1');
    expect(retrievedField1Value).toEqual(42);
}

export async function simpleGetMultipleAttrs(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
            field2: string;
        },
        container2: {
            field1: string;
            field2: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
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
        'record1': {
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"}
        }
    });
    const retrievedFieldsValues: {} = await store.getMultipleAttrs([
        'record1.container1.field1', 'record1.container1.field2', 'record1.container2.field1'
    ]);
    expect(retrievedFieldsValues).toEqual({
        'record1.container1.field1': "c1.f1",
        'record1.container1.field2': "c1.f2",
        'record1.container2.field1': "c2.f1",
    });
}

export async function simpleUpdateAttr(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'container1': new MapModel({fields: {
                'field1': new BasicFieldModel({})
            }})
        }})
    );
    store.loadFromData({'record1': {'container1': {'field1': "c1.f1.alteration1"}}});

    const oldValue: string | undefined = await store.updateAttr('record1.container1.field1', "c1.f1.alteration2");
    expect(oldValue).toEqual("c1.f1.alteration1");

    const retrievedNewValue: string | undefined = await store.getAttr('record1.container1.field1');
    expect(retrievedNewValue).toEqual("c1.f1.alteration2");
}

export async function simpleUpdateMultipleAttrs(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
            field2: string;
        },
        container2: {
            field1: string;
            field2: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
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
        'record1': {
            'container1': {'field1': "c1.f1.alteration1", 'field2': "c1.f2.alteration1"},
            'container2': {'field1': "c2.f1.alteration1", 'field2': "c2.f2.alteration1"}
        }
    });
    const oldFieldsValues = await store.updateMultipleAttrs({
        'record1.container1.field1': "c1.f1.alteration2",
        'record1.container1.field2': "c1.f2.alteration2",
        'record1.container2.field1': "c2.f1.alteration2"
    });
    expect(oldFieldsValues).toEqual({
        'record1.container1.field1': "c1.f1.alteration1",
        'record1.container1.field2': "c1.f2.alteration1",
        'record1.container2.field1': "c2.f1.alteration1",
    });

    const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs([
        'record1.container1.field1', 'record1.container1.field2', 'record1.container2.field1', 'record1.container2.field2'
    ]);
    expect(retrievedFieldsValuesAfterUpdate).toEqual({
        'record1.container1.field1': "c1.f1.alteration2",
        'record1.container1.field2': "c1.f2.alteration2",
        'record1.container2.field1': "c2.f1.alteration2",
        'record1.container2.field2': "c2.f2.alteration1",
    });
}

export async function simpleDeleteAttr(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'container1': new MapModel({fields: {
                'field1': new BasicFieldModel({})
            }})
        }})
    );
    store.loadFromData({'record1': {'container1': {'field1': "c1.f1"}}});

    const retrievedValueBeforeDeletion: string | undefined = await store.getAttr('record1.container1.field1');
    expect(retrievedValueBeforeDeletion).toEqual("c1.f1");

    await store.deleteAttr('record1.container1.field1');
    const retrievedValueAfterDeletion: string | undefined = await store.getAttr('record1.container1.field1');
    expect(retrievedValueAfterDeletion).toEqual(undefined);
}

export async function simpleDeleteMultipleAttrs(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
            field2: string;
        },
        container2: {
            field1: string;
            field2: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
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
        'record1': {
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"}
        }
    });
    await store.deleteMultipleAttrs([
        'record1.container1.field1', 'record1.container1.field2', 'record1.container2.field1'
    ]);

    const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs([
        'record1.container1.field1', 'record1.container1.field2', 'record1.container2.field1', 'record1.container2.field2'
    ]);
    expect(retrievedFieldsValuesAfterUpdate).toEqual({
        'record1.container1.field1': undefined,
        'record1.container1.field2': undefined,
        'record1.container2.field1': undefined,
        'record1.container2.field2': "c2.f2",
    });
}

export async function simpleRemoveAttr(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'container1': new MapModel({fields: {
                'field1': new BasicFieldModel({})
            }})
        }})
    );
    store.loadFromData({'record1': {'container1': {'field1': "c1.f1"}}});

    const retrievedValueBeforeRemoval: string | undefined = await store.getAttr('record1.container1.field1');
    expect(retrievedValueBeforeRemoval).toEqual("c1.f1");

    const removedValue: string | undefined = await store.removeAttr('record1.container1.field1');
    expect(removedValue).toEqual("c1.f1");

    const retrievedValueAfterRemoval: string | undefined = await store.getAttr('record1.container1.field1');
    expect(retrievedValueAfterRemoval).toEqual(undefined);
}

export async function simpleRemoveMultipleAttrs(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
            field2: string;
        },
        container2: {
            field1: string;
            field2: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
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
        'record1': {
            'container1': {'field1': "c1.f1", 'field2': "c1.f2"},
            'container2': {'field1': "c2.f1", 'field2': "c2.f2"}
        }
    });
    await store.deleteMultipleAttrs([
        'record1.container1.field1', 'record1.container1.field2', 'record1.container2.field1'
    ]);

    const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs([
        'record1.container1.field1', 'record1.container1.field2', 'record1.container2.field1', 'record1.container2.field2'
    ]);
    expect(retrievedFieldsValuesAfterUpdate).toEqual({
        'record1.container1.field1': undefined,
        'record1.container1.field2': undefined,
        'record1.container2.field1': undefined,
        'record1.container2.field2': "c2.f2",
    });
}

export async function listenersSharing(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
            field2: string;
        },
        container2: {
            field1: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
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
        'record1': {
            'container1': {'field1': "c1.f1.alteration1", 'field2': "c1.f2.alteration1"},
            'container2': {'field1': "c2.f1.alteration1"}
        }
    });

    let listenersTriggersCounter: number = 0;
    store.subscribeMultipleAttrs(
        ['record1.container1.field1', 'record1.container1.field2', 'record1.container2.field1'],
        () => {
            listenersTriggersCounter += 1;
        }
    );
    await store.updateMultipleAttrs({
        'record1.container1.field1': "c1.f1.alteration2",
        'record1.container1.field2': "c1.f2.alteration2",
        'record1.container2.field1': "c2.f1.alteration2",
    });
    expect(listenersTriggersCounter).toEqual(1);
}

export async function listenersSeparation(storeFactory: StoreFactory) {
    interface StoreItemModel {
        container1: {
            field1: string;
            field2: string;
        },
        container2: {
            field1: string;
        }
    }
    const store = storeFactory<StoreItemModel>(
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
        'record1': {
            'container1': {'field1': "c1.f1.alteration1", 'field2': "c1.f2.alteration1"},
            'container2': {'field1': "c2.f1.alteration1"}
        }
    });

    let listenersTriggersCounter: number = 0;
    store.subscribeToAttr('record1.container1.field1',() => {
        listenersTriggersCounter += 1;
    });
    store.subscribeToAttr('record1.container1.field2',() => {
        listenersTriggersCounter += 1;
    });
    store.subscribeToAttr('record1.container2.field1',() => {
        listenersTriggersCounter += 1;
    });
    await store.updateMultipleAttrs({
        'record1.container1.field1': "c1.f1.alteration2",
        'record1.container1.field2': "c1.f2.alteration2",
        'record1.container2.field1': "c2.f1.alteration2",
    });
    expect(listenersTriggersCounter).toEqual(3);
}

export async function simpleUpdateDataToAttr(storeFactory: StoreFactory) {
    interface StoreItemModel {
        value: string;
        container: {
            field1: string;
        },
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'value': new BasicFieldModel({}),
            'container': new MapModel({fields: {
                'field1': new BasicFieldModel({}),
            }}),
        }})
    );

    await store.updateDataToAttr('record1', {
        'value': "v",
        'container': {
            'field1': "c1.f1"
        }
    });
    const retrievedRecord = await store.getAttr('record1');
    expect(retrievedRecord).toEqual({
        'value': "v",
        'container': Immutable.Record()
    });
}