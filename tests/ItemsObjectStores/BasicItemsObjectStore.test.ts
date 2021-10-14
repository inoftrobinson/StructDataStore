import {MapModel} from "../../src/ModelsFields";
import BasicItemsObjectStore from "../../src/Stores/ObjectStores/ItemsObjectStores/BasicItemsObjectStore";
import {
    listenersSeparation,
    listenersSharing,
    simpleDeleteAttr,
    simpleDeleteMultipleAttrs,
    simpleGetAttr,
    simpleGetMultipleAttrs,
    simpleRemoveAttr,
    simpleRemoveMultipleAttrs,
    simpleUpdateAttr,
    simpleUpdateMultipleAttrs
} from "./BaseItemsObjectStore.test";


function storeFactory<T>(itemModel: MapModel) {
    return new BasicItemsObjectStore<T>({
        itemModel: itemModel,
        retrieveAllItemsCallable: () => Promise.resolve(undefined)
    });
}

describe('BasicItemsObjectStore', () => {
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
});