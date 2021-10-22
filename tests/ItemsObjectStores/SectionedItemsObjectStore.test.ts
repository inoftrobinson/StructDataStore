import * as _ from 'lodash';
import {SectionedItemsObjectStore, MapModel} from "../../src";
import {
    listenersSeparation,
    listenersSharing,
    simpleDeleteAttr,
    simpleDeleteMultipleAttrs,
    simpleGetAttr,
    simpleGetMultipleAttrs,
    simpleRemoveAttr,
    simpleRemoveMultipleAttrs,
    simpleUpdateAttr, simpleUpdateDataToAttr, simpleUpdateDataToMultipleAttrs,
    simpleUpdateMultipleAttrs, typedDictUpdateDataToAttr, typedDictUpdateDataToMultipleAttrs
} from "./BaseItemsObjectStoreTests";


function storeFactory<T>(itemModel: MapModel) {
    return new SectionedItemsObjectStore<T>({
        itemModel: itemModel,
        retrieveSingleItemCallable: (key: string) => Promise.resolve({success: false, data: {} as T}),
        retrieveMultipleItemsCallable: (keys: string[]) => Promise.resolve({
            success: true, data: _.transform(keys, (output: { [key: string]: T }, key: string) => { output[key] = {} as T; })
        })
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

    test('simple updateDataToMultipleAttrs', () => simpleUpdateDataToMultipleAttrs(storeFactory));

    test('typedDict updateDataToMultipleAttrs', () => typedDictUpdateDataToAttr(storeFactory));

    test('typedDict updateDataToMultipleAttrs', () => typedDictUpdateDataToMultipleAttrs(storeFactory));
});