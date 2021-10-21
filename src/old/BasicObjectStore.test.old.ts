import {BasicObjectStore} from "../Stores/ObjectStores/BasicObjectStore";
import {BasicFieldModel, MapModel} from "../ModelsFields";

interface StoreObjectModel {
    container1: {
        field1: number;
    }
}

describe('BasicObjectStore', () => {
    test('Simple attribute retrieval', async () => {
        const store = new BasicObjectStore<StoreObjectModel>({
            retrieveDataCallable: () => Promise.resolve({success: true, data: {}}),
            objectModel: new MapModel({fields: {
                'container1': new MapModel({fields: {
                    'field1': new BasicFieldModel({})
                }})
            }})}
        );
        store.loadFromData({'container1': {'field1': 42}});
        const retrievedField1Value: number | undefined = await store.getAttr('container1.field1');
        expect(retrievedField1Value).toEqual(42);
    });
});