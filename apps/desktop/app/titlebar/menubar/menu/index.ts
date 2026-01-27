/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { Menu, MenuItem } from 'electron'
import { $, EventHelper, EventLike, EventType, addDisposableListener, append, hasClass, isAncestor, removeNode } from 'base/common/dom'
import { Disposable, dispose } from 'base/common/lifecycle'
import { CETMenuItem, IMenuItem, IMenuStyle } from './item'
import { KeyCode, KeyCodeUtils, KeyMod } from 'base/common/keyCodes'
import { StandardKeyboardEvent } from 'base/browser/keyboardEvent'
import { Color, RGBA } from 'base/common/color'
import { Emitter, Event } from 'base/common/event'
import { MenuBarOptions } from '../menubar-options'
import { CETSeparator } from './separator'
import { CETSubMenu, ISubMenuData } from './submenu'
import { isLinux, isFreeBSD } from 'base/common/platform'
import { IMenuIcons } from 'menubar'

export enum Direction {
	Right,
	Left
}

export interface IMenuOptions {
	ariaLabel?: string
	enableMnemonics?: boolean
}

interface ActionTrigger {
	keys: KeyCode[]
	keyDown: boolean
}

export class CETMenu extends Disposable {
	private focusedItem?: number = undefined
	private items: IMenuItem[] = []

	private mnemonics: Map<KeyCode, Array<CETMenuItem>>

	private triggerKeys: ActionTrigger = {
		keys: [KeyCode.Enter, KeyCode.Space],
		keyDown: true
	}

	parentData: ISubMenuData = {
		parent: this
	}

	private _onDidCancel = this._register(new Emitter<void>())

	constructor(private menuContainer: HTMLElement, private menuIcons: IMenuIcons, private parentOptions: MenuBarOptions, private currentOptions: IMenuOptions, private closeSubMenu = () => { }) {
		super()

		this.mnemonics = new Map<KeyCode, Array<CETMenuItem>>()

		this._register(addDisposableListener(this.menuContainer, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e)
			let eventHandled = true

			if (event.equals(KeyCode.UpArrow)) {
				this.focusPrevious()
			} else if (event.equals(KeyCode.DownArrow)) {
				this.focusNext()
			} else if (event.equals(KeyCode.Escape)) {
				this.cancel()
			} else if (this.isTriggerKeyEvent(event)) {
				// Staying out of the else branch even if not triggered
				if (this.triggerKeys && this.triggerKeys.keyDown) {
					this.doTrigger(event)
				}
			} else {
				eventHandled = false
			}

			if (eventHandled) {
				event.preventDefault()
				event.stopPropagation()
			}
		}))

		this._register(addDisposableListener(this.menuContainer, EventType.KEY_UP, e => {
			const event = new StandardKeyboardEvent(e)

			// Run action on Enter/Space
			if (this.isTriggerKeyEvent(event)) {
				if (this.triggerKeys && !this.triggerKeys.keyDown) {
					this.doTrigger(event)
				}

				event.preventDefault()
				event.stopPropagation()
				// Recompute focused item
			} else if (event.equals(KeyCode.Tab) || event.equals(KeyMod.Shift | KeyCode.Tab)) {
				this.updateFocusedItem()
			}
		}))

		if (this.currentOptions.enableMnemonics) {
			this._register(addDisposableListener(this.menuContainer, EventType.KEY_DOWN, (e) => {
				const key = KeyCodeUtils.fromString(e.key)
				if (this.mnemonics.has(key)) {
					const items = this.mnemonics.get(key)!

					if (items.length === 1) {
						if (items[0] instanceof CETSubMenu) {
							this.focusItemByElement(items[0].element)
						}

						items[0].onClick(e)
					}

					if (items.length > 1) {
						const item = items.shift()
						if (item) {
							this.focusItemByElement(item.element)
							items.push(item)
						}

						this.mnemonics.set(key, items)
					}
				}
			}))
		}

		if (isLinux) {
			this._register(addDisposableListener(this.menuContainer, EventType.KEY_DOWN, e => {
				const event = new StandardKeyboardEvent(e)

				if (event.equals(KeyCode.Home) || event.equals(KeyCode.PageUp)) {
					this.focusedItem = this.items.length - 1
					this.focusNext()
					EventHelper.stop(e, true)
				} else if (event.equals(KeyCode.End) || event.equals(KeyCode.PageDown)) {
					this.focusedItem = 0
					this.focusPrevious()
					EventHelper.stop(e, true)
				}
			}))
		}

		if (isFreeBSD) {
			this._register(addDisposableListener(this.menuContainer, EventType.KEY_DOWN, e => {
				const event = new StandardKeyboardEvent(e)

				if (event.equals(KeyCode.Home) || event.equals(KeyCode.PageUp)) {
					this.focusedItem = this.items.length - 1
					this.focusNext()
					EventHelper.stop(e, true)
				} else if (event.equals(KeyCode.End) || event.equals(KeyCode.PageDown)) {
					this.focusedItem = 0
					this.focusPrevious()
					EventHelper.stop(e, true)
				}
			}))
		}

		this._register(addDisposableListener(this.menuContainer, EventType.MOUSE_OUT, e => {
			const relatedTarget = e.relatedTarget as HTMLElement
			if (!isAncestor(relatedTarget, this.menuContainer)) {
				this.focusedItem = undefined
				this.updateFocus()
				e.stopPropagation()
			}
		}))

		this._register(addDisposableListener(this.menuContainer, EventType.MOUSE_UP, e => {
			// Absorb clicks in menu dead space https://github.com/Microsoft/vscode/issues/63575
			EventHelper.stop(e, true)
		}))

		this._register(addDisposableListener(this.menuContainer, EventType.MOUSE_OVER, e => {
			let target = e.target as HTMLElement

			if (!target || !isAncestor(target, this.menuContainer) || target === this.menuContainer) {
				return
			}

			while (target.parentElement !== this.menuContainer && target.parentElement !== null) {
				target = target.parentElement
			}

			if (hasClass(target, 'cet-action-item')) {
				const lastFocusedItem = this.focusedItem
				this.setFocusedItem(target)

				if (lastFocusedItem !== this.focusedItem) {
					this.updateFocus()
				}
			}
		}))

		if (this.currentOptions.ariaLabel) {
			this.menuContainer.setAttribute('aria-label', this.currentOptions.ariaLabel)
		}
	}

	trigger(index: number): void {
		if (index <= this.items.length && index >= 0) {
			const item = this.items[index]

			if (item instanceof CETSubMenu) {
				this.focus(index)
			}
		}
	}

	createMenu(menuItems: MenuItem[] | undefined) {
		if (!menuItems) return

		menuItems.forEach((menuItem: MenuItem) => {
			if (!menuItem) return

			const itemElement = $('li.cet-action-item', { role: 'presentation' })

			// Prevent native context menu on actions
			this._register(addDisposableListener(itemElement, EventType.CONTEXT_MENU, (e: EventLike) => {
				e.preventDefault()
				e.stopPropagation()
			}))

			let item: CETMenuItem

			if (menuItem.type === 'separator') {
				item = new CETSeparator(menuItem, this.menuIcons, this.parentOptions, this.currentOptions)
			} else if (menuItem.type === 'submenu' || menuItem.submenu) {
				const submenuItems = (menuItem.submenu as Menu).items
				item = new CETSubMenu(menuItem, this.menuIcons, submenuItems, this.parentData, this.parentOptions, this.currentOptions, this.closeSubMenu)

				if (this.currentOptions.enableMnemonics) {
					const mnemonic = item.mnemonic

					if (mnemonic && item.isEnabled()) {
						let actionItems: CETMenuItem[] = []
						if (this.mnemonics.has(mnemonic)) {
							actionItems = this.mnemonics.get(mnemonic)!
						}

						actionItems.push(item)

						this.mnemonics.set(mnemonic, actionItems)
					}
				}
			} else {
				item = new CETMenuItem(menuItem, this.menuIcons, this.parentOptions, this.currentOptions, this.items, this.closeSubMenu)

				if (this.currentOptions.enableMnemonics) {
					const mnemonic = item.mnemonic

					if (mnemonic && item.isEnabled()) {
						let actionItems: CETMenuItem[] = []

						if (this.mnemonics.has(mnemonic)) {
							actionItems = this.mnemonics.get(mnemonic)!
						}

						actionItems.push(item)

						this.mnemonics.set(mnemonic, actionItems)
					}
				}
			}

			item.render(itemElement)
			this.items.push(item)
			append(this.menuContainer, itemElement)
		})
	}

	private isTriggerKeyEvent(event: StandardKeyboardEvent): boolean {
		let ret = false
		if (this.triggerKeys) {
			this.triggerKeys.keys.forEach(keyCode => {
				ret = ret || event.equals(keyCode)
			})
		}

		return ret
	}

	private updateFocusedItem(): void {
		for (let i = 0; i < this.menuContainer.children.length; i++) {
			const elem = this.menuContainer.children[i]
			if (isAncestor(document.activeElement, elem)) {
				this.focusedItem = i
				break
			}
		}
	}

	focus(index?: number): void
	focus(selectFirst?: boolean): void
	focus(arg?: any): void {
		let selectFirst: boolean = false
		let index: number | undefined

		if (arg === undefined) {
			selectFirst = true
		} else if (typeof arg === 'number') {
			index = arg
		} else if (typeof arg === 'boolean') {
			selectFirst = arg
		}

		if (selectFirst && typeof this.focusedItem === 'undefined') {
			// Focus the first enabled item
			this.focusedItem = this.items.length - 1
			this.focusNext()
		} else {
			if (index !== undefined) {
				this.focusedItem = index
			}

			this.updateFocus()
		}
	}

	private focusNext(): void {
		if (typeof this.focusedItem === 'undefined') {
			this.focusedItem = this.items.length - 1
		}

		const startIndex = this.focusedItem
		let item: IMenuItem

		do {
			this.focusedItem = (this.focusedItem + 1) % this.items.length
			item = this.items[this.focusedItem]
		} while ((this.focusedItem !== startIndex && !item.isEnabled()) || item.isSeparator())

		if ((this.focusedItem === startIndex && !item.isEnabled()) || item.isSeparator()) {
			this.focusedItem = undefined
		}

		this.updateFocus()
	}

	private focusPrevious(): void {
		if (typeof this.focusedItem === 'undefined') {
			this.focusedItem = 0
		}

		const startIndex = this.focusedItem
		let item: IMenuItem

		do {
			this.focusedItem = this.focusedItem - 1

			if (this.focusedItem < 0) {
				this.focusedItem = this.items.length - 1
			}

			item = this.items[this.focusedItem]
		} while ((this.focusedItem !== startIndex && !item.isEnabled()) || item.isSeparator())

		if ((this.focusedItem === startIndex && !item.isEnabled()) || item.isSeparator()) {
			this.focusedItem = undefined
		}

		this.updateFocus()
	}

	private updateFocus() {
		if (typeof this.focusedItem === 'undefined') {
			this.menuContainer.focus()
		}

		for (let i = 0; i < this.items.length; i++) {
			const item = this.items[i]

			if (i === this.focusedItem) {
				if (item.isEnabled()) {
					item.focus()
				} else {
					this.menuContainer.focus()
				}
			} else {
				item.blur()
			}
		}
	}

	private doTrigger(event: StandardKeyboardEvent): void {
		if (typeof this.focusedItem === 'undefined') {
			return // nothing to focus
		}

		// trigger action
		const item = this.items[this.focusedItem]
		if (item instanceof CETMenuItem) {
			item.onClick(event)
		}
	}

	private cancel(): void {
		if (document.activeElement instanceof HTMLElement) {
			(<HTMLElement>document.activeElement).blur() // remove focus from focused action
		}

		this._onDidCancel.fire()
	}

	private focusItemByElement(element: HTMLElement | undefined) {
		const lastFocusedItem = this.focusedItem
		if (element) this.setFocusedItem(element)

		if (lastFocusedItem !== this.focusedItem) {
			this.updateFocus()
		}
	}

	private setFocusedItem(element: HTMLElement) {
		this.focusedItem = Array.prototype.findIndex.call(this.container.children, (elem) => elem === element)
	}

	applyStyle(style: IMenuStyle) {
		const container = this.menuContainer

		if (style?.backgroundColor) {
			let transparency = this.parentOptions?.menuTransparency!

			if (transparency < 0) transparency = 0
			if (transparency > 1) transparency = 1
			const rgba = style.backgroundColor?.rgba
			container.style.backgroundColor = `rgb(${rgba.r} ${rgba.g} ${rgba.b} / ${1 - transparency})`
		}

		if (this.items) {
			this.items.forEach(item => {
				if (item instanceof CETMenuItem || item instanceof CETSeparator) {
					item.updateStyle(style)
				}
			})
		}
	}

	get container(): HTMLElement {
		return this.menuContainer
	}

	get onDidCancel(): Event<void> {
		return this._onDidCancel.event
	}

	dispose() {
		dispose(this.items)
		this.items = []

		removeNode(this.container)

		super.dispose()
	}
}