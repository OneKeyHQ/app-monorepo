/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { ipcRenderer, Menu } from 'electron'
import { Color } from 'base/common/color'
import { $, addClass, addDisposableListener, append, EventType, hide, prepend, removeClass, show } from 'base/common/dom'
import { isLinux, isFreeBSD, isMacintosh, isWindows, platform, PlatformToString } from 'base/common/platform'
import { MenuBar } from 'menubar'
import { TitleBarOptions } from './options'
import { ThemeBar } from './themebar'
import { ACTIVE_FOREGROUND, ACTIVE_FOREGROUND_DARK, BOTTOM_TITLEBAR_HEIGHT, DEFAULT_ITEM_SELECTOR, getPx, INACTIVE_FOREGROUND, INACTIVE_FOREGROUND_DARK, loadWindowIcons, menuIcons, TOP_TITLEBAR_HEIGHT_MAC, TOP_TITLEBAR_HEIGHT_WIN } from 'consts'

export class CustomTitlebar extends ThemeBar {
	private titlebar: HTMLElement
	private dragRegion: HTMLElement
	private icon: HTMLElement
	private menuBarContainer: HTMLElement
	private title: HTMLElement
	private controlsContainer: HTMLElement
	private container: HTMLElement

	private menuBar?: MenuBar

	private isInactive: boolean = false

	private controls: {
		minimize: HTMLElement
		maximize: HTMLElement
		close: HTMLElement
	}

	private resizer: {
		top: HTMLElement
		left: HTMLElement
	}

	private currentOptions: TitleBarOptions = {
		closeable: true,
		enableMnemonics: true,
		// hideWhenClickingClose: false,
		iconSize: 16,
		itemBackgroundColor: undefined,
		maximizable: true,
		menuPosition: 'left',
		menuTransparency: 0,
		minimizable: true,
		onlyShowMenuBar: false,
		shadow: false,
		titleHorizontalAlignment: 'center',
		tooltips: {
			close: 'Close',
			maximize: 'Maximize',
			minimize: 'Minimize',
			restoreDown: 'Restore Down'
		},
		unfocusEffect: true
	}

	private platformIcons: { [key: string]: string }

	/**
	 * Create a new TitleBar instance
	 * @param options The options for the title bar
	 */
	constructor(options: TitleBarOptions) {
		super()

		this.currentOptions = { ...this.currentOptions, ...options }

		const jWindowIcons = (menuIcons as any)[PlatformToString(platform)?.toLocaleLowerCase()]
		this.platformIcons = jWindowIcons

		this.titlebar = $('.cet-titlebar')
		this.dragRegion = $('.cet-drag-region')
		this.icon = $('.cet-icon')
		this.menuBarContainer = $('.cet-menubar')
		this.title = $('.cet-title')
		this.controlsContainer = $('.cet-window-controls')
		this.container = $('.cet-container')

		this.controls = {
			minimize: $('.cet-control-minimize'),
			maximize: $('.cet-control-maximize'),
			close: $('.cet-control-close')
		}

		this.resizer = {
			top: $('.cet-resizer.top'),
			left: $('.cet-resizer.left')
		}

		append(this.titlebar, this.dragRegion)
		append(this.titlebar, this.resizer.left)
		append(this.titlebar, this.resizer.top)

		this.loadIcons()
		this.setupBackgroundColor()
		this.createIcon()
		this.setupMenubar()
		this.setupTitle()
		this.setupWindowControls()
		this.setupContainer()
		this.setupTitleBar()

		this.loadEvents()

		// this.registerTheme(ThemeBar.win)
	}

	private loadIcons() {
		const icons = this.currentOptions.icons

		if (icons) {
			const { platformIcons } = loadWindowIcons(icons)
			this.platformIcons = platformIcons
		}
	}

	/**
	 * Setup the background color of the title bar
	 * By default, it will use the meta theme-color or msapplication-TileColor and if it doesn't exist, it will use white
	 */
	private setupBackgroundColor() {
		let color = this.currentOptions.backgroundColor

		if (!color) {
			const metaColor = document.querySelectorAll('meta[name="theme-color"]') || document.querySelectorAll('meta[name="msapplication-TileColor"]')
			metaColor.forEach((meta) => {
				color = Color.fromHex(meta.getAttribute('content')!)
			})

			if (!color) color = Color.WHITE

			this.currentOptions.backgroundColor = color
		}

		this.titlebar.style.backgroundColor = color.toString()
	}

	/**
	 * Render the icon of the title bar, if is mac, it will not render
	 * By default, it will use the first icon found in the head of the document
	 */
	private createIcon() {
		// const onlyRendererMenuBar = this.currentOptions.onlyShowMenuBar

		if (isMacintosh) return

		let icon = this.currentOptions.icon

		if (!icon) {
			const tagLink = document.querySelectorAll('link')
			tagLink.forEach((link) => {
				if (link.getAttribute('rel') === 'icon' || link.getAttribute('rel') === 'shortcut icon') {
					icon = link.getAttribute('href')!
				}

				this.currentOptions.icon = icon
			})
		}

		if (icon) {
			const windowIcon = append(this.icon, $('img'))

			if (typeof icon === 'string') {
				windowIcon.setAttribute('src', icon)
			} else {
				windowIcon.setAttribute('src', icon.toDataURL())
			}

			this.setIconSize(this.currentOptions.iconSize!)
			append(this.titlebar, this.icon)
		}
	}

	private setIconSize(size: number) {
		if (size < 16) size = 16
		if (size > 24) size = 24

		this.icon.firstElementChild!.setAttribute('style', `height: ${size}px`)
	}

	private setupMenubar() {
		ipcRenderer.invoke('request-application-menu')?.then((menu?: Menu) => this.updateMenu(menu))

		const menuPosition = this.currentOptions.menuPosition

		if (menuPosition) {
			this.updateMenuPosition(menuPosition)
		}

		append(this.titlebar, this.menuBarContainer)
	}

	private setupTitle() {
		const onlyRendererMenuBar = this.currentOptions.onlyShowMenuBar

		if (onlyRendererMenuBar) return

		this.updateTitle(document.title)
		this.updateTitleAlignment(this.currentOptions.titleHorizontalAlignment!)
		append(this.titlebar, this.title)
	}

	private createControlButton(element: HTMLElement, icon: string, title: string, active: boolean = true) {
		addClass(element, 'cet-control-icon')
		element.innerHTML = icon
		element.title = title

		if (!active) {
			addClass(element, 'inactive')
		}

		append(this.controlsContainer, element)
	}

	private setupWindowControls() {
		const onlyRendererMenuBar = this.currentOptions.onlyShowMenuBar
		const tooltips = this.currentOptions.tooltips!

		if (isMacintosh || onlyRendererMenuBar) return

		this.createControlButton(this.controls.minimize, this.platformIcons?.minimize, tooltips.minimize!, this.currentOptions.minimizable)
		this.createControlButton(this.controls.maximize, this.platformIcons?.maximize, tooltips.maximize!, this.currentOptions.maximizable)
		this.createControlButton(this.controls.close, this.platformIcons?.close, tooltips.close!, this.currentOptions.closeable)

		append(this.titlebar, this.controlsContainer)
	}

	private setupContainer() {
		const containerOverflow = this.currentOptions.containerOverflow

		if (containerOverflow) {
			this.container.style.overflow = containerOverflow
		}

		while (document.body.firstChild) {
			append(this.container, document.body.firstChild)
		}

		append(document.body, this.container)
	}

	private setupTitleBar() {
		const order = this.currentOptions.order
		const hasShadow = this.currentOptions.shadow

		addClass(this.titlebar, `cet-${PlatformToString(platform)?.toLocaleLowerCase()}`)

		if (order) {
			addClass(this.titlebar, `cet-${order}`)
		}

		if (hasShadow) {
			addClass(this.titlebar, 'cet-shadow')
		}

		if (!isMacintosh) {
			this.title.style.cursor = 'default'
		}

		prepend(document.body, this.titlebar)
	}

	private loadEvents() {
		const onlyRendererMenuBar = this.currentOptions.onlyShowMenuBar

		if (onlyRendererMenuBar) return

		const minimizable = this.currentOptions.minimizable
		const maximizable = this.currentOptions.maximizable
		const closeable = this.currentOptions.closeable

		this.onDidChangeMaximized(ipcRenderer.sendSync('window-event', 'window-is-maximized'))

		ipcRenderer.on('window-maximize', (_, isMaximized) => this.onDidChangeMaximized(isMaximized))
		ipcRenderer.on('window-fullscreen', (_, isFullScreen) => this.onWindowFullScreen(isFullScreen))
		ipcRenderer.on('window-focus', (_, isFocused) => this.onWindowFocus(isFocused))

		if (minimizable) {
			addDisposableListener(this.controls.minimize, EventType.CLICK, () => {
				ipcRenderer.send('window-event', 'window-minimize')
			})
		}

		if (isMacintosh) {
			addDisposableListener(this.titlebar, EventType.DBLCLICK, () => {
				ipcRenderer.send('window-event', 'window-maximize')
			})
		}

		if (maximizable) {
			addDisposableListener(this.controls.maximize, EventType.CLICK, () => {
				ipcRenderer.send('window-event', 'window-maximize')
			})
		}

		if (closeable) {
			addDisposableListener(this.controls.close, EventType.CLICK, () => {
				ipcRenderer.send('window-event', 'window-close')
			})
		}
	}


	// TODO: Refactor, verify if is possible use into menubar
	private closeMenu = () => {
		if (this.menuBar) {
			this.menuBar.blur()
		}
	}

	private onBlur() {
		this.isInactive = true
		this.updateStyles()
	}

	private onFocus() {
		this.isInactive = false
		this.updateStyles()
	}

	private onMenuBarVisibilityChanged(visible: boolean) {
		if (isWindows || isLinux || isFreeBSD) {
			if (visible) {
				// Hack to fix issue #52522 with layered webkit-app-region elements appearing under cursor
				hide(this.dragRegion)
				setTimeout(() => show(this.dragRegion), 50)
			}
		}
	}

	private onMenuBarFocusChanged(focused: boolean) {
		if (isWindows || isLinux || isFreeBSD) {
			if (focused) hide(this.dragRegion)
			else show(this.dragRegion)
		}
	}

	private onDidChangeMaximized(isMaximized: Boolean) {
		const maximize = this.controls.maximize

		if (maximize) {
			maximize.title = isMaximized ? this.currentOptions.tooltips?.restoreDown! : this.currentOptions.tooltips?.maximize!
			maximize.innerHTML = isMaximized ? this.platformIcons?.restore : this.platformIcons?.maximize
		}

		if (this.resizer) {
			if (isMaximized) hide(this.resizer.top, this.resizer.left)
			else show(this.resizer.top, this.resizer.left)
		}
	}

	private updateMenu(menu?: Menu) {
		if (isMacintosh || !menu) return

		if (this.menuBar) this.menuBar.dispose()

		this.menuBar = new MenuBar(this.menuBarContainer, menuIcons, this.currentOptions, { enableMnemonics: true }, this.closeMenu) // TODO: Verify menubar options
		this.menuBar.push(menu)
		this.menuBar.update()
		this.menuBar.onVisibilityChange(e => this.onMenuBarVisibilityChanged(e))
		this.menuBar.onFocusStateChange(e => this.onMenuBarFocusChanged(e))

		this.updateStyles()
	}

	private updateStyles() {
		if (this.isInactive) {
			addClass(this.titlebar, 'inactive')
		} else {
			removeClass(this.titlebar, 'inactive')
		}

		const backgroundColor = this.isInactive && this.currentOptions.unfocusEffect
			? this.currentOptions.backgroundColor?.lighten(0.12)
			: this.currentOptions.backgroundColor

		if (backgroundColor) {
			this.titlebar.style.backgroundColor = backgroundColor?.toString()
		}

		let foregroundColor: Color

		if (backgroundColor?.isLighter()) {
			addClass(this.titlebar, 'light')

			foregroundColor = this.isInactive && this.currentOptions.unfocusEffect
				? INACTIVE_FOREGROUND_DARK
				: ACTIVE_FOREGROUND_DARK
		} else {
			removeClass(this.titlebar, 'light')

			foregroundColor = this.isInactive && this.currentOptions.unfocusEffect
				? INACTIVE_FOREGROUND
				: ACTIVE_FOREGROUND
		}

		this.titlebar.style.color = foregroundColor?.toString()

		const updatedWindowControls = ipcRenderer.sendSync('update-window-controls', {
			color: backgroundColor?.toString(),
			symbolColor: foregroundColor?.toString(),
			height: TOP_TITLEBAR_HEIGHT_WIN
		})

		if (updatedWindowControls) {
			hide(this.controlsContainer)
		} else {
			show(this.controlsContainer)
		}

		if (this.menuBar) {
			let fgColor
			const backgroundColor = this.currentOptions.menuBarBackgroundColor || this.currentOptions.backgroundColor!.darken(0.12)

			const foregroundColor = backgroundColor?.isLighter()
				? INACTIVE_FOREGROUND_DARK
				: INACTIVE_FOREGROUND

			const bgColor = this.currentOptions.itemBackgroundColor && !this.currentOptions.itemBackgroundColor.equals(backgroundColor)
				? this.currentOptions.itemBackgroundColor
				: DEFAULT_ITEM_SELECTOR

			if (bgColor?.equals(DEFAULT_ITEM_SELECTOR)) {
				fgColor = backgroundColor?.isLighter() ? ACTIVE_FOREGROUND_DARK : ACTIVE_FOREGROUND
			} else {
				fgColor = bgColor?.isLighter() ? ACTIVE_FOREGROUND_DARK : ACTIVE_FOREGROUND
			}

			this.menuBar.setStyles({
				backgroundColor,
				foregroundColor,
				selectionBackgroundColor: bgColor,
				selectionForegroundColor: fgColor,
				separatorColor: this.currentOptions.menuSeparatorColor ?? foregroundColor,
				svgColor: this.currentOptions.svgColor
			})
		}
	}

	private canCenterTitle() {
		const menuBarContainerMargin = 20
		const menuSpaceLimit = window.innerWidth / 2 - this.menuBarContainer.getBoundingClientRect().right - menuBarContainerMargin
		return (this.title.getBoundingClientRect().width / 2 <= menuSpaceLimit)
	}

	/// Public methods

	/**
	 * Update title bar styles based on focus state.
	 * @param hasFocus focus state of the window
	 */
	public onWindowFocus(focus: boolean) {
		if (this.titlebar) {
			if (focus) {
				removeClass(this.titlebar, 'inactive')
				this.onFocus()
			} else {
				addClass(this.titlebar, 'inactive')
				this.menuBar?.blur()
				this.onBlur()
			}
		}
	}

	/**
	 * Update the full screen state and hide or show the title bar.
	 * @param fullscreen Fullscreen state of the window
	 */
	public onWindowFullScreen(fullscreen: boolean) {
		const height = isMacintosh ? TOP_TITLEBAR_HEIGHT_MAC : TOP_TITLEBAR_HEIGHT_WIN
		const hasShadow = this.currentOptions.shadow

		if (!isMacintosh) {
			if (fullscreen) {
				hide(this.titlebar)
				this.container.style.top = '0px'
			} else {
				show(this.titlebar)
				if (this.currentOptions.menuPosition === 'bottom') {
					this.container.style.top = getPx(BOTTOM_TITLEBAR_HEIGHT)
					this.controlsContainer.style.height = getPx(TOP_TITLEBAR_HEIGHT_WIN)
				} else {
					this.container.style.top = getPx(height + (hasShadow ? 1 : 0))
				}
			}
		}
	}

	/**
	 * Update the title of the title bar.
	 * You can use this method if change the content of `<title>` tag on your html.
	 * @param title The title of the title bar and document.
	 */
	public updateTitle(title: string) {
		this.title.innerText = title
		document.title = title

		return this
	}

	/**
	 * It method set new icon to title-bar-icon of title-bar.
	 * @param path path to icon
	 */
	public updateIcon(path: string) {
		if (this.icon) {
			this.icon.firstElementChild!.setAttribute('src', path)
		}

		return this
	}

	/**
	 * Horizontal alignment of the title.
	 * @param side `left`, `center` or `right`.
	 */
	public updateTitleAlignment(side: 'left' | 'center' | 'right') {
		const order = this.currentOptions.order
		const menuPosition = this.currentOptions.menuPosition

		if (side === 'left' || (side === 'right' && order === 'inverted')) {
			removeClass(this.title, 'cet-title-left')
			removeClass(this.title, 'cet-title-right')
			removeClass(this.title, 'cet-title-center')
			addClass(this.title, 'cet-title-left')
		}

		if (side === 'right' || (side === 'left' && order === 'inverted')) {
			if (side !== 'left' && order !== 'inverted') {
				this.controlsContainer.style.marginLeft = '10px'
			}

			removeClass(this.title, 'cet-title-left')
			removeClass(this.title, 'cet-title-right')
			removeClass(this.title, 'cet-title-center')
			addClass(this.title, 'cet-title-right')
		}

		if (side === 'center') {
			removeClass(this.title, 'cet-title-left')
			removeClass(this.title, 'cet-title-right')
			removeClass(this.title, 'cet-title-center')

			if (menuPosition !== 'bottom') {
				addDisposableListener(window, 'resize', () => {
					if (this.canCenterTitle()) {
						addClass(this.title, 'cet-title-center')
					} else {
						removeClass(this.title, 'cet-title-center')
					}
				})
				if (this.canCenterTitle()) {
					addClass(this.title, 'cet-title-center')
				}
			}

			if (!isMacintosh && order === 'first-buttons') {
				this.controlsContainer.style.marginLeft = 'auto'
			}

			this.title.style.maxWidth = 'calc(100% - 296px)'
		}

		return this
	}

	/**
	 * Update the background color of the title bar
	 * @param backgroundColor The color for the background
	 */
	public updateBackground(backgroundColor: Color) {
		if (typeof backgroundColor === 'string') backgroundColor = Color.fromHex(backgroundColor)
		this.currentOptions.backgroundColor = backgroundColor
		this.updateStyles()

		return this
	}

	/**
	 * Update the item background color of the menubar
	 * @param itemBGColor The color for the item background
	 */
	public updateItemBGColor(itemBGColor: Color) {
		if (typeof itemBGColor === 'string') itemBGColor = Color.fromHex(itemBGColor)
		this.currentOptions.itemBackgroundColor = itemBGColor
		this.updateStyles()

		return this
	}

	/**
	 * Update the menu from Menu.getApplicationMenu()
	 */
	public async refreshMenu() {
		if (!isMacintosh) {
			ipcRenderer.invoke('request-application-menu')
				.then((menu: Menu) => this.updateMenu(menu))
		}

		return this
	}

	/**
	 * Update the position of menubar.
	 * @param menuPosition The position of the menu `left` or `bottom`.
	 */
	public updateMenuPosition(menuPosition: 'left' | 'bottom') {
		const height = isMacintosh ? TOP_TITLEBAR_HEIGHT_MAC : TOP_TITLEBAR_HEIGHT_WIN
		const onlyRendererMenuBar = this.currentOptions.onlyShowMenuBar
		const hasShadow = this.currentOptions.shadow

		this.currentOptions.menuPosition = menuPosition

		if (menuPosition === 'left' || onlyRendererMenuBar) {
			this.titlebar.style.height = getPx(height + (hasShadow ? 1 : 0))
			this.container.style.top = getPx(height + (hasShadow ? 1 : 0))
			removeClass(this.menuBarContainer, 'bottom')
		} else {
			this.titlebar.style.height = getPx(BOTTOM_TITLEBAR_HEIGHT)
			this.container.style.top = getPx(BOTTOM_TITLEBAR_HEIGHT)
			this.controlsContainer.style.height = getPx(height)
			addClass(this.menuBarContainer, 'bottom')
		}

		return this
	}

	/**
	 * Remove the titlebar, menubar and all methods.
	 */
	public dispose() {
		// if (this.menuBar) this.menuBar.dispose()
		this.titlebar.remove()
		while (this.container.firstChild) append(document.body, this.container.firstChild)
		this.container.remove()
	}

	public get titlebarElement() {
		return this.titlebar
	}

	public get menubarElement() {
		return this.menuBar
	}

	public get containerElement() {
		return this.container
	}

	public get titleElement() {
		return this.title
	}
}
