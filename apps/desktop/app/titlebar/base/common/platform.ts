/* eslint-disable indent */
/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

let _isWindows = false
let _isMacintosh = false
let _isLinux = false
let _isFreeBSD = false
let _isNative = false
let _isWeb = false

export interface IProcessEnvironment {
	[key: string]: string;
}

interface INodeProcess {
	platform: string;
	env: IProcessEnvironment;
	getuid(): number;
	nextTick: Function;
	versions?: {
		electron?: string;
	};
	type?: string;

}
declare let process: INodeProcess
declare let global: any

interface INavigator {
	userAgent: string;
	language: string;
}
declare let navigator: INavigator
declare let self: any

const isElectronRenderer = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.electron !== 'undefined' && process.type === 'renderer')

// OS detection
if (typeof navigator === 'object' && !isElectronRenderer) {
	const userAgent = navigator.userAgent
	_isWindows = userAgent.indexOf('Windows') >= 0
	_isMacintosh = userAgent.indexOf('Macintosh') >= 0
	_isLinux = userAgent.indexOf('Linux') >= 0
	_isFreeBSD = userAgent.indexOf('FreeBSD') >= 0
	_isWeb = true
} else if (typeof process === 'object') {
	_isWindows = (process.platform === 'win32')
	_isMacintosh = (process.platform === 'darwin')
	_isLinux = (process.platform === 'linux')
	_isFreeBSD = (process.platform === 'freebsd')
	_isNative = true
}

export const enum Platform {
	Web,
	Mac,
	Linux,
	FreeBSD,
	Windows
}
export function PlatformToString(platform: Platform) {
	switch (platform) {
		case Platform.Web: return 'Web'
		case Platform.Mac: return 'Mac'
		case Platform.Linux: return 'Linux'
		case Platform.FreeBSD: return 'FreeBSD'
		case Platform.Windows: return 'Windows'
	}
}

let _platform: Platform = Platform.Web
if (_isNative) {
	if (_isMacintosh) {
		_platform = Platform.Mac
	} else if (_isWindows) {
		_platform = Platform.Windows
	} else if (_isLinux) {
		_platform = Platform.Linux
	} else if (_isFreeBSD) {
		_platform = Platform.FreeBSD
	}
}

export const isWindows = _isWindows
export const isMacintosh = _isMacintosh
export const isLinux = _isLinux
export const isFreeBSD = _isFreeBSD
export const isNative = _isNative
export const isWeb = _isWeb
export const platform = _platform

export function isRootUser(): boolean {
	return _isNative && !_isWindows && (process.getuid() === 0)
}

const g = typeof global === 'object' ? global : {} as any
const _globals = (typeof self === 'object' ? self : g)
export const globals: any = _globals

let _setImmediate: ((callback: (...args: any[]) => void) => number) | null = null
export function setImmediate(callback: (...args: any[]) => void): number {
	if (_setImmediate === null) {
		if (globals.setImmediate) {
			_setImmediate = globals.setImmediate.bind(globals)
		} else if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
			_setImmediate = process.nextTick.bind(process)
		} else {
			_setImmediate = globals.setTimeout.bind(globals)
		}
	}
	return _setImmediate!(callback)
}

export const enum OperatingSystem {
	Windows = 1,
	Macintosh = 2,
	Linux = 3,
	FreeBSD = 4
}

const _wl = _isWindows ? OperatingSystem.Windows : OperatingSystem.Linux | OperatingSystem.FreeBSD
export const OS = (_isMacintosh ? OperatingSystem.Macintosh : _wl)

export const enum AccessibilitySupport {
	/**
	 * This should be the browser case where it is not known if a screen reader is attached or no.
	 */
	Unknown = 0,
	Disabled = 1,
	Enabled = 2
}