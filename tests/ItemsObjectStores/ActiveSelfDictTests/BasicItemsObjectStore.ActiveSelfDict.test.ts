import {BasicItemsObjectStore, MapModel} from "../../../src";
import {typedDictActiveSelfDict} from "./BaseItemsObjectStore.ActiveSelfDictTests";


function storeFactory<T>(itemModel: MapModel) {
    return new BasicItemsObjectStore<T>({
        itemModel: itemModel,
        retrieveAllItemsCallable: () => Promise.resolve({
            success: true, data: {'record1': {} as T}
        })
    });
}

describe('BasicItemsObjectStore ActiveSelfDict', () => {
    test('typedDictActiveSelfDict', () => typedDictActiveSelfDict(storeFactory));
});
