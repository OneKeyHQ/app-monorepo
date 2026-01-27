/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { MenuItem } from 'electron'
import { applyFill } from 'consts'
import { CETMenuItem } from './item'
import { IDisposable, dispose } from 'base/common/lifecycle'
import { $, EventHelper, EventLike, EventType, addClass, addClasses, addDisposableListener, append, hasClass, isAncestor } from 'base/common/dom'
import { StandardKeyboardEvent } from 'base/browser/keyboardEvent'
import { CETMenu, IMenuOptions } from './index'
import { RunOnceScheduler } from 'base/common/async'
import { MenuBarOptions } from 'menubar/menubar-options'
import { KeyCode } from 'base/common/keyCodes'
import { IMenuIcons } from 'menubar'

export interface ISubMenuData {
	parent: CETMenu;
	submenu?: CETMenu;
}

export class CETSubMenu extends CETMenuItem {
	private mySubmenu?: CETMenu | null
	private submenuContainer?: HTMLElement
	private submenuIndicator?: HTMLElement
	private submenuDisposables: IDisposable[] = []
	private mouseOver = false
	private showScheduler: RunOnceScheduler
	private hideScheduler: RunOnceScheduler
	private _closeSubMenu = () => { }

	constructor(item: MenuItem, private submenuIcons: IMenuIcons, private submenuItems: MenuItem[], private parentData: ISubMenuData, private submenuParentOptions: MenuBarOptions, private submenuOptions: IMenuOptions, closeSubMenu = () => { }) {
		super(item, submenuIcons, submenuParentOptions, submenuOptions)

		this._closeSubMenu = closeSubMenu

		this.showScheduler = new RunOnceScheduler(() => {
			if (this.mouseOver) {
				this.cleanupExistingSubmenu(false)
				this.createSubmenu(false)
			}
		}, 250)

		this.hideScheduler = new RunOnceScheduler(() => {
			if (this.element && (!isAncestor(document.activeElement, this.element) && this.parentData.submenu === this.mySubmenu)) {
				this.parentData.parent.focus(false)
				this.cleanupExistingSubmenu(true)
			}
		}, 750)
	}

	render(el: HTMLElement): void {
		super.render(el)

		if (!this.itemElement) {
			return
		}

		addClass(this.itemElement, 'cet-submenu-item')
		this.itemElement.setAttribute('aria-haspopup', 'true')

		this.submenuIndicator = append(this.itemElement, $('span.cet-submenu-indicator'))
		this.submenuIndicator.innerHTML = this.submenuIcons.submenuIndicator
		this.submenuIndicator.setAttribute('aria-hidden', 'true')

		applyFill(this.submenuIndicator, this.menuStyle?.svgColor, this.menuStyle?.foregroundColor)

		if (this.element) {
			addDisposableListener(this.element, EventType.KEY_UP, e => {
				const event = new StandardKeyboardEvent(e)
				if (event.equals(KeyCode.RightArrow) || event.equals(KeyCode.Enter)) {
					EventHelper.stop(e, true)

					this.createSubmenu(true)
				}
			})

			addDisposableListener(this.element, EventType.KEY_DOWN, e => {
				const event = new StandardKeyboardEvent(e)
				if (event.equals(KeyCode.RightArrow) || event.equals(KeyCode.Enter)) {
					EventHelper.stop(e, true)
				}
			})

			addDisposableListener(this.element, EventType.MOUSE_OVER, e => {
				if (!this.mouseOver) {
					this.mouseOver = true

					this.showScheduler.schedule()
				}
			})

			addDisposableListener(this.element, EventType.MOUSE_LEAVE, e => {
				this.mouseOver = false
			})

			addDisposableListener(this.element, EventType.FOCUS_OUT, e => {
				if (this.element && !isAncestor(document.activeElement, this.element)) {
					this.hideScheduler.schedule()
				}
			})
		}
	}

	private cleanupExistingSubmenu(force: boolean): void {
		if (this.parentData.submenu && (force || (this.parentData.submenu !== this.mySubmenu))) {
			this.parentData.submenu.dispose()
			this.parentData.submenu = undefined

			if (this.submenuContainer) {
				this.submenuContainer = undefined
			}
		}
	}

	private createSubmenu(selectFirstItem = true): void {
		if (!this.itemElement) {
			return
		}

		if (this.element) {
			if (!this.parentData.submenu) {
				this.submenuContainer = append(this.element, $('.cet-submenu'))
				addClasses(this.submenuContainer, 'cet-menubar-menu-container')

				this.parentData.submenu = new CETMenu(this.submenuContainer, this.submenuIcons, this.submenuParentOptions, this.submenuOptions, this._closeSubMenu)
				this.parentData.submenu.createMenu(this.submenuItems)

				if (this.menuStyle) {
					this.parentData.submenu.applyStyle(this.menuStyle)
				}

				const boundingRect = this.element.getBoundingClientRect()
				const childBoundingRect = this.submenuContainer.getBoundingClientRect()
				const computedStyles = getComputedStyle(this.parentData.parent.container)
				const paddingTop = parseFloat(computedStyles.paddingTop || '0') || 0

				if (window.innerWidth <= boundingRect.right + childBoundingRect.width) {
					this.submenuContainer.style.left = '10px'
					this.submenuContainer.style.top = `${this.element.offsetTop + boundingRect.height}px`
				} else {
					this.submenuContainer.style.left = `${this.element.offsetWidth}px`
					this.submenuContainer.style.top = `${this.element.offsetTop - paddingTop}px`
				}

				this.submenuDisposables.push(addDisposableListener(this.submenuContainer, EventType.KEY_UP, e => {
					const event = new StandardKeyboardEvent(e)
					if (event.equals(KeyCode.LeftArrow)) {
						EventHelper.stop(e, true)

						this.parentData.parent.focus()

						if (this.parentData.submenu) {
							this.parentData.submenu.dispose()
							this.parentData.submenu = undefined
						}

						this.submenuDisposables = dispose(this.submenuDisposables)
						this.submenuContainer = undefined
					}
				}))

				this.submenuDisposables.push(addDisposableListener(this.submenuContainer, EventType.KEY_DOWN, e => {
					const event = new StandardKeyboardEvent(e)
					if (event.equals(KeyCode.LeftArrow)) {
						EventHelper.stop(e, true)
					}
				}))

				this.submenuDisposables.push(this.parentData.submenu.onDidCancel(() => {
					this.parentData.parent.focus()

					if (this.parentData.submenu) {
						this.parentData.submenu.dispose()
						this.parentData.submenu = undefined
					}

					this.submenuDisposables = dispose(this.submenuDisposables)
					this.submenuContainer = undefined
				}))

				this.parentData.submenu.focus(selectFirstItem)

				this.mySubmenu = this.parentData.submenu
			} else {
				this.parentData.submenu.focus(false)
			}
		}
	}

	protected applyStyle(): void {
		super.applyStyle()

		if (!this.menuStyle) return

		const isSelected = this.element && hasClass(this.element, 'focused')
		const fgColor = isSelected && this.menuStyle.selectionForegroundColor ? this.menuStyle.selectionForegroundColor : this.menuStyle.foregroundColor
		applyFill(this.submenuIndicator, this.submenuParentOptions.svgColor, fgColor)

		if (this.parentData.submenu) this.parentData.submenu.applyStyle(this.menuStyle)
	}

	onClick(e: EventLike): void {
		// stop clicking from trying to run an action
		EventHelper.stop(e, true)

		this.cleanupExistingSubmenu(false)
		this.createSubmenu(false)
	}

	dispose(): void {
		super.dispose()

		this.hideScheduler.dispose()

		if (this.mySubmenu) {
			this.mySubmenu.dispose()
			this.mySubmenu = null
		}

		if (this.submenuContainer) {
			this.submenuDisposables = dispose(this.submenuDisposables)
			this.submenuContainer = undefined
		}
	}
}