import * as immutable from "immutable";
import {
    BasicItemsObjectStore,
    SectionedItemsObjectStore,
    BasicFieldModel,
    MapModel,
    TypedDictFieldModel
} from "../../src";
import {attempt} from "lodash";


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
    const retrievedFieldsValues: {} = await store.getMultipleAttrs({
        'getter1': {attrKeyPath: '{{recordKey}}.container1.field1', queryKwargs: {'recordKey': "record1"}},
        'getter2': {attrKeyPath: '{{recordKey}}.container1.field2', queryKwargs: {'recordKey': "record1"}},
        'getter3': {attrKeyPath: '{{recordKey}}.container2.field1', queryKwargs: {'recordKey': "record1"}}
    });
    expect(retrievedFieldsValues).toEqual({
        'getter1': "c1.f1",
        'getter2': "c1.f2",
        'getter3': "c2.f1",
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
        'setter1': {attrKeyPath: 'record1.container1.field1', valueToSet: "c1.f1.alteration2"},
        'setter2': {attrKeyPath: 'record1.container1.field2', valueToSet: "c1.f2.alteration2"},
        'setter3': {attrKeyPath: 'record1.container2.field1', valueToSet: "c2.f1.alteration2"}
    });
    expect(oldFieldsValues).toEqual({
        'setter1': "c1.f1.alteration1",
        'setter2': "c1.f2.alteration1",
        'setter3': "c2.f1.alteration1",
    });

    const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs({
        'getter1': {attrKeyPath: '{{recordKey}}.container1.field1', queryKwargs: {'recordKey': "record1"}},
        'getter2': {attrKeyPath: '{{recordKey}}.container1.field2', queryKwargs: {'recordKey': "record1"}},
        'getter3': {attrKeyPath: '{{recordKey}}.container2.field1', queryKwargs: {'recordKey': "record1"}},
        'getter4': {attrKeyPath: '{{recordKey}}.container2.field2', queryKwargs: {'recordKey': "record1"}}
    });
    expect(retrievedFieldsValuesAfterUpdate).toEqual({
        'getter1': "c1.f1.alteration2",
        'getter2': "c1.f2.alteration2",
        'getter3': "c2.f1.alteration2",
        'getter4': "c2.f2.alteration1",
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

    const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs({
        'getter1': {attrKeyPath: '{{recordKey}}.container1.field1', queryKwargs: {'recordKey': "record1"}},
        'getter2': {attrKeyPath: '{{recordKey}}.container1.field2', queryKwargs: {'recordKey': "record1"}},
        'getter3': {attrKeyPath: '{{recordKey}}.container2.field1', queryKwargs: {'recordKey': "record1"}},
        'getter4': {attrKeyPath: '{{recordKey}}.container2.field2', queryKwargs: {'recordKey': "record1"}}
    });
    expect(retrievedFieldsValuesAfterUpdate).toEqual({
        'getter1': undefined,
        'getter2': undefined,
        'getter3': undefined,
        'getter4': "c2.f2",
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

    const retrievedFieldsValuesAfterUpdate: {} = await store.getMultipleAttrs({
        'getter1': {attrKeyPath: '{{recordKey}}.container1.field1', queryKwargs: {'recordKey': "record1"},
        'getter2': {attrKeyPath: '{{recordKey}}.container1.field2', queryKwargs: {'recordKey': "record1"},
        'getter3': {attrKeyPath: '{{recordKey}}.container2.field1', queryKwargs: {'recordKey': "record1"},
        'getter4': {attrKeyPath: '{{recordKey}}.container2.field2', queryKwargs: {'recordKey': "record1"}
    });
    expect(retrievedFieldsValuesAfterUpdate).toEqual({
        'getter1': undefined,
        'getter2': undefined,
        'getter3': undefined,
        'getter4': "c2.f2",
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
        'setter1': {attrKeyPath: 'record1.container1.field1', valueToSet: "c1.f1.alteration2"},
        'setter2': {attrKeyPath: 'record1.container1.field2', valueToSet: "c1.f2.alteration2"},
        'setter3': {attrKeyPath: 'record1.container2.field1', valueToSet: "c2.f1.alteration2"},
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
        'setter1': {attrKeyPath: 'record1.container1.field1', valueToSet: "c1.f1.alteration2"},
        'setter2': {attrKeyPath: 'record1.container1.field2', valueToSet: "c1.f2.alteration2"},
        'setter3': {attrKeyPath: 'record1.container2.field1', valueToSet: "c2.f1.alteration2"},
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
    const retrievedRecord: immutable.RecordOf<StoreItemModel> | undefined = await store.getAttr('record1');
    expect(retrievedRecord?.toJS()).toEqual({
        'value': "v",
        'container': {'field1': "c1.f1"}
    });
}

export async function simpleUpdateDataToMultipleAttrs(storeFactory: StoreFactory) {
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

    await store.updateDataToMultipleAttrs({
        'setter1': {
            attrKeyPath: '{{recordKey}}.value',
            queryKwargs: {'recordKey': "record1"},
            valueToSet: "v"
        },
        'setter2': {
            attrKeyPath: '{{recordKey}}.container',
            queryKwargs: {'recordKey': "record1"},
            valueToSet: {'field1': "c1.f1"}
        }
    });
    const retrievedRecord: immutable.RecordOf<StoreItemModel> | undefined = await store.getAttr('record1');
    expect(retrievedRecord?.toJS()).toEqual({
        'value': "v",
        'container': {'field1': "c1.f1"}
    });
}

export async function typedDictUpdateDataToAttr(storeFactory: StoreFactory) {
    interface StoreItemModel {
        items: { [itemKey: string]: string }
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'items': new TypedDictFieldModel({
                keyName: 'itemKey', keyType: 'string',
                itemType: new BasicFieldModel({})
            }),
        }})
    );
    store.loadFromData({'record1': {items: {}}});

    await store.updateDataToAttr('record1.items.item42A', "i1.i42A");
    const retrievedItem: any | undefined = await store.getAttr('record1.items.item42A');
    expect(retrievedItem).toEqual("i1.i42A");
}

export async function typedDictUpdateDataToMultipleAttrs(storeFactory: StoreFactory) {
    interface StoreItemModel {
        items: { [itemKey: string]: string },
    }
    const store = storeFactory<StoreItemModel>(
        new MapModel({fields: {
            'items': new TypedDictFieldModel({
                keyName: 'itemKey', keyType: 'string',
                itemType: new BasicFieldModel({})
            }),
        }})
    );
    store.loadFromData({'record1': {items: {}}});

    await store.updateDataToMultipleAttrs({
        'record1.items.item42A': "i1.i42A",
        'record1.items.item42B': "i2.i42B"
    });
    const retrievedItems: {
        'firstItem': string | undefined,
        'secondItem': string | undefined,
    } = await store.getMultipleAttrs({
        'firstItem': {
            attrKeyPath: '{{recordKey}}.items.{{itemKey}}',
            queryKwargs: {'recordKey': "record1", 'itemKey': "item42A"}
        },
        'secondItem': {
            attrKeyPath: '{{recordKey}}.items.{{itemKey}}',
            queryKwargs: {'recordKey': "record1", 'itemKey': "item42B"}
        }
    });
    expect(retrievedItems).toEqual({
        'firstItem': "i1.i42A",
        'secondItem': "i2.i42B"
    });
}