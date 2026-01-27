/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

/**
 * Returns the last element of an array.
 * @param array The array.
 * @param n Which element from the end (default is zero).
 */
export function tail<T>(array: ArrayLike<T>, n: number = 0): T {
	return array[array.length - (1 + n)];
}

/**
 * @returns a new array with all falsy values removed. The original array IS NOT modified.
 */
export function coalesce<T>(array: Array<T | undefined | null>): T[] {
	if (!array) {
		return array
	}
	return <T[]>array.filter(e => !!e)
}