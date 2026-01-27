/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { MenuItem } from 'electron'
import { CETMenuItem, IMenuStyle } from './item'
import { IMenuOptions } from './index'
import { $, append } from 'base/common/dom'
import { MenuBarOptions } from 'menubar/menubar-options'
import { IMenuIcons } from 'menubar'

export class CETSeparator extends CETMenuItem {
	private separatorElement?: HTMLElement

	constructor(item: MenuItem, submenuIcons: IMenuIcons, submenuParentOptions: MenuBarOptions, submenuOptions: IMenuOptions) {
		super(item, submenuIcons, submenuParentOptions, submenuOptions)
	}

	render(container: HTMLElement) {
		if (container) {
			this.separatorElement = append(container, $('a.cet-action-label.separator', { role: 'presentation' }))
		}
	}

	updateStyle(style: IMenuStyle) {
		if (this.separatorElement && style.separatorColor) {
			this.separatorElement.style.borderBottomColor = style.separatorColor.toString()
		}
	}
}
