import {BasicObjectStore} from "../Stores/ObjectStores/BasicObjectStore";

type Model = { [key: string]: { item1: number } };

const store = new BasicObjectStore<Model>({
    objectModel: undefined, retrieveDataCallable(): Promise<any> {
        return Promise.resolve(undefined);
    }
});
const result = store.getAttr('rar.item1');