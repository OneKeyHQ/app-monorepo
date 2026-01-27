/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { toDisposable, IDisposable, Disposable } from 'base/common/lifecycle'
const baseTheme: string = require('static/theme/base.css')
const macTheme: string = require('static/theme/mac.css')
const winTheme: string = require('static/theme/win.css')

export interface CssStyle {
	addRule(rule: string): void;
}

export interface Theme {
	(collector: CssStyle): void;
}

class ThemingRegistry extends Disposable {
	private readonly theming: Theme[] = []

	constructor() {
		super()

		this.theming = []
	}

	protected onThemeChange(theme: Theme): IDisposable {
		this.theming.push(theme)
		return toDisposable(() => {
			const idx = this.theming.indexOf(theme)
			this.theming.splice(idx, 1)
		})
	}

	protected getTheming(): Theme[] {
		return this.theming
	}
}

export class ThemeBar extends ThemingRegistry {
	constructor() {
		super()

		this.registerTheme((collector: CssStyle) => {
			collector.addRule(baseTheme)
		})
	}

	protected registerTheme(theme: Theme) {
		this.onThemeChange(theme)

		const cssRules: string[] = []
		const hasRule: { [rule: string]: boolean } = {}
		const ruleCollector = {
			addRule: (rule: string) => {
				if (!hasRule[rule]) {
					cssRules.push(rule)
					hasRule[rule] = true
				}
			}
		}

		this.getTheming().forEach(p => p(ruleCollector))

		_applyRules(cssRules.join('\n'), 'titlebar-style')
	}

	static get win(): Theme {
		return (collector: CssStyle) => {
			collector.addRule(winTheme)
		}
	}

	static get mac(): Theme {
		return (collector: CssStyle) => {
			collector.addRule(macTheme)
		}
	}
}

function _applyRules(styleSheetContent: string, rulesClassName: string) {
	const themeStyles = document.head.getElementsByClassName(rulesClassName)

	if (themeStyles.length === 0) {
		const styleElement = document.createElement('style')
		styleElement.className = rulesClassName
		styleElement.innerHTML = styleSheetContent
		document.head.appendChild(styleElement)
	} else {
		(<HTMLStyleElement>themeStyles[0]).innerHTML = styleSheetContent
	}
}