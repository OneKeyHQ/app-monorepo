/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { Color } from 'base/common/color'
import { PlatformToString, isMacintosh, isWindows, platform } from 'base/common/platform'
import { IMenuIcons } from 'menubar'

export const INACTIVE_FOREGROUND_DARK = Color.fromHex('#222222')
export const ACTIVE_FOREGROUND_DARK = Color.fromHex('#333333')
export const INACTIVE_FOREGROUND = Color.fromHex('#EEEEEE')
export const ACTIVE_FOREGROUND = Color.fromHex('#FFFFFF')
export const DEFAULT_ITEM_SELECTOR = Color.fromHex('#0000001F')

export const IS_MAC_BIGSUR_OR_LATER = isMacintosh && parseInt(process.getSystemVersion().split('.')[0]) >= 11
export const BOTTOM_TITLEBAR_HEIGHT = 60
export const TOP_TITLEBAR_HEIGHT_MAC = IS_MAC_BIGSUR_OR_LATER ? 28 : 22
export const TOP_TITLEBAR_HEIGHT_WIN = 30

export const WINDOW_MIN_WIDTH = 400
export const WINDOW_MIN_HEIGHT = 270

export const MENU_MNEMONIC_REGEX = /\(&([^\s&])\)|(^|[^&])&([^\s&])/
export const MENU_ESCAPED_MNEMONIC_REGEX = /(&amp;)?(&amp;)([^\s&])/g

interface ITitlebarIcons extends IMenuIcons {
	linux: {
		minimize: string
		maximize: string
		restore: string
		close: string
	},
	freebsd: {
		minimize: string
		maximize: string
		restore: string
		close: string
	},
	windows: {
		minimize: string
		maximize: string
		restore: string
		close: string
	}
}

export const menuIcons: ITitlebarIcons = {
	submenuIndicator: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><polyline points="9 6 15 12 9 18" /></svg>',
	checkbox: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>',
	radioChecked: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="currentColor" d="M10,5 C7.2,5 5,7.2 5,10 C5,12.8 7.2,15 10,15 C12.8,15 15,12.8 15,10 C15,7.2 12.8,5 10,5 L10,5 Z M10,0 C4.5,0 0,4.5 0,10 C0,15.5 4.5,20 10,20 C15.5,20 20,15.5 20,10 C20,4.5 15.5,0 10,0 L10,0 Z M10,18 C5.6,18 2,14.4 2,10 C2,5.6 5.6,2 10,2 C14.4,2 18,5.6 18,10 C18,14.4 14.4,18 10,18 L10,18 Z" /></svg>',
	radioUnchecked: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="currentColor" d="M10,0 C4.5,0 0,4.5 0,10 C0,15.5 4.5,20 10,20 C15.5,20 20,15.5 20,10 C20,4.5 15.5,0 10,0 L10,0 Z M10,18 C5.6,18 2,14.4 2,10 C2,5.6 5.6,2 10,2 C14.4,2 18,5.6 18,10 C18,14.4 14.4,18 10,18 L10,18 Z" /></svg>',
	linux: {
		minimize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M11,4.9v1.1H0V4.399h11z"/></svg>',
		maximize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M0,1.7v7.6C0,10.2,0.8,11,1.7,11h7.6c0.9,0,1.7-0.8,1.7-1.7V1.7C11,0.8,10.2,0,9.3,0H1.7C0.8,0,0,0.8,0,1.7z M8.8,9.9H2.2c-0.6,0-1.1-0.5-1.1-1.1V2.2c0-0.6,0.5-1.1,1.1-1.1h6.7c0.6,0,1.1,0.5,1.1,1.1v6.7C9.9,9.4,9.4,9.9,8.8,9.9z"/></svg>',
		restore: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M7.9,2.2h-7C0.4,2.2,0,2.6,0,3.1v7C0,10.6,0.4,11,0.9,11h7c0.5,0,0.9-0.4,0.9-0.9v-7C8.8,2.6,8.4,2.2,7.9,2.2z M7.7,9.6 c0,0.2-0.1,0.3-0.3,0.3h-6c-0.2,0-0.3-0.1-0.3-0.3v-6c0-0.2,0.1-0.3,0.3-0.3h6c0.2,0,0.3,0.1,0.3,0.3V9.6z M10,0.9 c0,0.5-0.4,0.9-0.9,0.9h-2.1 c-0.5,0-0.9-0.4-0.9-0.9V0.9c0-0.5,0.4-0.9,0.9-0.9h2.1C9.6,0,10,0.4,10,0.9z"/></svg>',
		close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M6.279 5.5L11 10.221l-.779.779L5.5 6.279.779 11 0 10.221 4.721 5.5 0 .779.779 0 5.5 4.721 10.221 0 11 .779 6.279 5.5z"/></svg>'
	},
	freebsd: {
		minimize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M11,4.9v1.1H0V4.399h11z"/></svg>',
		maximize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M0,1.7v7.6C0,10.2,0.8,11,1.7,11h7.6c0.9,0,1.7-0.8,1.7-1.7V1.7C11,0.8,10.2,0,9.3,0H1.7C0.8,0,0,0.8,0,1.7z M8.8,9.9H2.2c-0.6,0-1.1-0.5-1.1-1.1V2.2c0-0.6,0.5-1.1,1.1-1.1h6.7c0.6,0,1.1,0.5,1.1,1.1v6.7C9.9,9.4,9.4,9.9,8.8,9.9z"/></svg>',
		restore: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M7.9,2.2h-7C0.4,2.2,0,2.6,0,3.1v7C0,10.6,0.4,11,0.9,11h7c0.5,0,0.9-0.4,0.9-0.9v-7C8.8,2.6,8.4,2.2,7.9,2.2z M7.7,9.6 c0,0.2-0.1,0.3-0.3,0.3h-6c-0.2,0-0.3-0.1-0.3-0.3v-6c0-0.2,0.1-0.3,0.3-0.3h6c0.2,0,0.3,0.1,0.3,0.3V9.6z M10,0.9 c0,0.5-0.4,0.9-0.9,0.9h-2.1 c-0.5,0-0.9-0.4-0.9-0.9V0.9c0-0.5,0.4-0.9,0.9-0.9h2.1C9.6,0,10,0.4,10,0.9z"/></svg>',
		close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M6.279 5.5L11 10.221l-.779.779L5.5 6.279.779 11 0 10.221 4.721 5.5 0 .779.779 0 5.5 4.721 10.221 0 11 .779 6.279 5.5z"/></svg>'
	},
	windows: {
		minimize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M11,4.9v1.1H0V4.399h11z"/></svg>',
		maximize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M0,1.7v7.6C0,10.2,0.8,11,1.7,11h7.6c0.9,0,1.7-0.8,1.7-1.7V1.7C11,0.8,10.2,0,9.3,0H1.7C0.8,0,0,0.8,0,1.7z M8.8,9.9H2.2c-0.6,0-1.1-0.5-1.1-1.1V2.2c0-0.6,0.5-1.1,1.1-1.1h6.7c0.6,0,1.1,0.5,1.1,1.1v6.7C9.9,9.4,9.4,9.9,8.8,9.9z"/></svg>',
		restore: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M7.9,2.2h-7C0.4,2.2,0,2.6,0,3.1v7C0,10.6,0.4,11,0.9,11h7c0.5,0,0.9-0.4,0.9-0.9v-7C8.8,2.6,8.4,2.2,7.9,2.2z M7.7,9.6 c0,0.2-0.1,0.3-0.3,0.3h-6c-0.2,0-0.3-0.1-0.3-0.3v-6c0-0.2,0.1-0.3,0.3-0.3h6c0.2,0,0.3,0.1,0.3,0.3V9.6z"/><path d="M10,0H3.5v1.1h6.1c0.2,0,0.3,0.1,0.3,0.3v6.1H11V1C11,0.4,10.6,0,10,0z"/></svg>',
		close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M6.279 5.5L11 10.221l-.779.779L5.5 6.279.779 11 0 10.221 4.721 5.5 0 .779.779 0 5.5 4.721 10.221 0 11 .779 6.279 5.5z"/></svg>'
	}
}

export function getPx(value: number): string {
	return `${value}px`
}

/**
 * Handles mnemonics for menu items. Depending on OS:
 * - Windows: Supported via & character (replace && with &)
 * - Linux: Supported via & character (replace && with &)
 * - FreeBSD: Supported via & character (replace && with &)
 * - macOS: Unsupported (replace && with empty string)
 */
export function mnemonicMenuLabel(label: string, forceDisableMnemonics?: boolean): string {
	if (isMacintosh || forceDisableMnemonics) {
		return label.replace(/\(&&\w\)|&&/g, '').replace(/&/g, isMacintosh ? '&' : '&&')
	}

	return label.replace(/&&|&/g, m => m === '&' ? '&&' : '&')
}

/**
 * Handles mnemonics for buttons. Depending on OS:
 * - Windows: Supported via & character (replace && with & and & with && for escaping)
 * - Linux: Supported via _ character (replace && with _)
 * - FreeBSD: Supported via _ character (replace && with _)
 * - macOS: Unsupported (replace && with empty string)
 */
export function mnemonicButtonLabel(label: string, forceDisableMnemonics?: boolean): string {
	if (isMacintosh || forceDisableMnemonics) {
		return label.replace(/\(&&\w\)|&&/g, '')
	}

	if (isWindows) {
		return label.replace(/&&|&/g, m => m === '&' ? '&&' : '&')
	}

	return label.replace(/&&/g, '_')
}

export function cleanMnemonic(label: string): string {
	const regex = MENU_MNEMONIC_REGEX

	const matches = regex.exec(label)
	if (!matches) {
		return label
	}

	const mnemonicInText = !matches[1]

	return label.replace(regex, mnemonicInText ? '$2$3' : '').trim()
}

export function parseAccelerator(accelerator: Electron.Accelerator | string): string {
	let acc = accelerator.toString()

	if (!isMacintosh) {
		acc = acc.replace(/(Cmd)|(Command)/gi, '')
	} else {
		acc = acc.replace(/(Ctrl)|(Control)/gi, '')
	}

	acc = acc.replace(/(Or)/gi, '')

	return acc
}

export function applyFill(element: HTMLElement | undefined | null, svgColor: Color | undefined, fgColor: Color | undefined, color = true) {
	let fillColor = ''

	if (svgColor) fillColor = svgColor.toString()
	else if (fgColor) fillColor = fgColor.toString()

	if (element && element !== null) {
		if (color) element.style.color = fillColor
		else element.style.backgroundColor = fillColor
	}
}

export function loadWindowIcons(icons: string | undefined): any {
	if (!icons) return

	const jWindowsIcons = require(icons)

	return {
		icons: jWindowsIcons,
		platformIcons: jWindowsIcons[PlatformToString(platform).toLocaleLowerCase()]
	}
}
