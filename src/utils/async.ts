import * as _ from 'lodash';
import {resolveResultOrPromiseOrCallbackResultOrCallbackPromise} from "./executors";


export async function asyncTriggerSubscribers(subscribers: { [index: number]: () => any }): Promise<any> {
    await Promise.all(_.map(subscribers, async (callback: () => any) => (
        await resolveResultOrPromiseOrCallbackResultOrCallbackPromise(callback())
    )));
}