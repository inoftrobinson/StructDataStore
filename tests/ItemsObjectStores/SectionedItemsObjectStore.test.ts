import {MapModel} from "../../src/ModelsFields";
import SectionedItemsObjectStore from "../../src/Stores/ObjectStores/ItemsObjectStores/SectionedItemsObjectStore";
import {
    listenersSeparation,
    listenersSharing,
    simpleDeleteAttr,
    simpleDeleteMultipleAttrs,
    simpleGetAttr,
    simpleGetMultipleAttrs,
    simpleRemoveAttr,
    simpleRemoveMultipleAttrs,
    simpleUpdateAttr, simpleUpdateDataToAttr,
    simpleUpdateMultipleAttrs
} from "./BaseItemsObjectStoreTests";


function storeFactory<T>(itemModel: MapModel) {
    return new SectionedItemsObjectStore<T>({
        itemModel: itemModel,
        retrieveSingleItemCallable: () => Promise.resolve(undefined),
        retrieveMultipleItemsCallable: () => Promise.resolve(undefined),
    });
}

describe('SectionedItemsObjectStore', () => {
    test('simple getAttr', () => simpleGetAttr(storeFactory));

    test('simple getMultipleAttrs', () => simpleGetMultipleAttrs(storeFactory));

    test('simple updateAttr', () => simpleUpdateAttr(storeFactory));

    test('simple updateMultipleAttrs', () => simpleUpdateMultipleAttrs(storeFactory));

    test('simple deleteAttr', () => simpleDeleteAttr(storeFactory));

    test('simple deleteMultipleAttrs', () => simpleDeleteMultipleAttrs(storeFactory));

    test('simple removeAttr', () => simpleRemoveAttr(storeFactory));

    test('simple removeMultipleAttrs', () => simpleRemoveMultipleAttrs(storeFactory));

    test('listeners sharing', () => listenersSharing(storeFactory));

    test('listeners separation', () => listenersSeparation(storeFactory));

    test('simple updateDataToAttr', () => simpleUpdateDataToAttr(storeFactory));
});