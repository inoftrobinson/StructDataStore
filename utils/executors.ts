export function isPromise(potentialPromise: any): boolean {
    return Promise.resolve(potentialPromise) === potentialPromise;
}

export function resolveResultOrCallbackResult<T>(
    handler: (T | ((...args: any[]) => T) | ((...args: any[]) => Promise<T>)), callbackArgs?: any[]
): T {
    return typeof handler !== 'function' ? handler as T : (handler as (...args: any[]) => any)(...(callbackArgs || []));
}

export function resolveResultOrPromiseOrCallbackResultOrCallbackPromise<T>(
    handler: (T | ((...args: any[]) => T) | ((...args: any[]) => Promise<T>)), callbackArgs?: any[]
): Promise<T> {
   if (typeof handler !== 'function') {
        return isPromise(handler) ? (handler as unknown as Promise<T>) : new Promise(resolve => resolve(handler as T));
    } else {
        const handlerResult: T | Promise<T> = (handler as (...args: any[]) => any)(...(callbackArgs || []));
        return isPromise(handlerResult) ? (handlerResult as Promise<T>) : new Promise(resolve => resolve(handlerResult as T));
    }
}