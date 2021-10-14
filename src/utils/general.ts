import * as _ from "lodash";


export function deepDifference(object: { [key: string]: any }, base: { [key: string]: any }): { [key: string]: any } {
	function changes(object: { [key: string]: any }, base: { [key: string]: any }) {
		return _.transform(object, (result: { [key: string]: any }, value: any, key: string) => {
			if (!_.isEqual(value, base[key])) {
				result[key] = (_.isObject(value) && _.isObject(base[key])) ? changes(value, base[key]) : value;
			}
		});
	}
	return changes(object, base);
}

export function shallowDifference(object: { [key: string]: any }, base: { [key: string]: any }): { [key: string]: any } {
    return _.transform(object, function(result: { [key: string]: any }, value: any, key: string) {
        if (!_.isEqual(value, base[key])) {
            result[key] = value;
        }
    });
}

export function deepMissing(object: { [key: string]: any }, base: { [key: string]: any }): { [key: string]: true | { [key: string]: any } } {
    function changes(object: { [key: string]: any }, base: { [key: string]: any }) {
        return _.transform(object, (result: { [key: string]: any }, value: any, key: string) => {
            if (!_.has(base, key)) {
                result[key] = true;
            } else {
                if (_.isObject(value) && _.isObject(base[key])) {
                    const missingChildren: { [key: string]: any } = changes(value, base[key]);
                    if (Object.keys(missingChildren).length > 0) {
                        result[key] = missingChildren;
                    }
                }
            }
        });
    }
    return changes(object, base);
}

export function deepRemoveNulls(item: { [key: string]: any }): { [key: string]: any } | any[] {
    return _.transform(item, (result: {[p: string]: any}, value: any, key: string | number) => {
        if (value != null) {
            result[key] = ((_.isObject(value) && _.isObject((value as { [p: string]: any })[key])) ?
                    deepRemoveNulls(((value as { [p: string]: any })[key] as { [p: string]: any })) : value
            );
        }
    });
}


export function shallowMissing(object: { [key: string]: any }, base: { [key: string]: any }): { [key: string]: true } {
    return _.transform(object, (result: { [key: string]: any }, value: any, key: string) => {
        if (!_.has(base, key)) {
            result[key] = true;
        }
    });
}

export function shallowMissingOrNull(object: { [key: string]: any }, base: { [key: string]: any }): { [key: string]: true } {
    return _.transform(object, (result: { [key: string]: any }, value: any, key: string) => {
        if (!_.has(base, key) || base[key] == null) {
            result[key] = true;
        }
    });
}