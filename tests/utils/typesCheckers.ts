// import {Equals} from './Any/Equals'
// import {Boolean} from 'ts-toolbelt/Boolean/_Internal'
import {Boolean, Any} from 'ts-toolbelt';

/** Test should pass */
export type Pass = 1

/** Test should fail */
export type Fail = 0

/**
 * Check or test the validity of a type
 * @param debug to debug with parameter hints (`ctrl+p`, `ctrl+shift+space`)
 * @example
 * ```ts
 * // see in `tst` folder
 * ```
 */
export declare function check<Type, Expect, Outcome extends Boolean>(
    debug?: Type
): Any.Equals<Any.Equals<Type, Expect>, Outcome>

/**
 * Validates a batch of [[check]]
 * @param checks a batch of [[check]]
 * @example
 * ```ts
 * // see in `tst` folder
 * ```
 */
export declare function checks(checks: 1[]): void;