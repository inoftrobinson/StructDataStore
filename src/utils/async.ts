import * as _ from 'lodash';
import {resolveResultOrPromiseOrCallbackResultOrCallbackPromise} from "../../../applications/utils/Comparisons";


export async function asyncTriggerSubscribers(subscribers: { [index: number]: () => any }): Promise<any> {
    await Promise.all(_.map(subscribers, async (callback: () => any) => (
        await resolveResultOrPromiseOrCallbackResultOrCallbackPromise(callback())
    )));
}