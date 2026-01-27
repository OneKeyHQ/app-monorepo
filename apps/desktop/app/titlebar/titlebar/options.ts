/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { NativeImage } from 'electron'
import { Color } from 'base/common/color'
import { MenuBarOptions } from '../menubar/menubar-options'

export interface TitleBarOptions extends MenuBarOptions {
	/**
	 * The background color of titlebar.
	 * **The default is `#ffffff`**
	 */
	backgroundColor?: Color
	/**
	 * Sets the value for the overflow of the container after title bar.
	 * **The default value is auto**
	 */
	containerOverflow?: 'auto' | 'hidden' | 'visible'
	/**
	 * Define if the close button is enabled.
	 * **The default is true**
	 */
	closeable?: boolean
	/**
	 * When the close button is clicked, the window is hidden instead of closed.
	 * **The default is false**
	 */
	// hideWhenClickingClose?: boolean;
	/**
	 * The icon shown on the left side of titlebar.
	 * **The default is the favicon of the index.html**
	 */
	icon?: NativeImage | string
	/**
	 * The icon size of titlebar. Value between 16 and 24.
	 * **The default is 16**
	 */
	iconSize?: number
	/**
	 * Define if the maximize and restore buttons are enabled.
	 * **The default is true**
	 */
	maximizable?: boolean
	/**
	 * Define if the minimize button is enabled.
	 * **The default is true**
	 */
	minimizable?: boolean
	/**
	 * Set the order of the elements on the title bar. You can use `inverted`, `first-buttons` or don't add for.
	 * **The default is undefined**
	 */
	order?: 'inverted' | 'first-buttons'
	/**
	 * Show shadow of titlebar.
	 * **The default is false*
	 */
	shadow?: boolean
	/**
	 * Set horizontal alignment of the window title.
	 * **The default value is center**
	 */
	titleHorizontalAlignment?: 'left' | 'center' | 'right'
	/**
	 * Set the titles of controls of the window.
	 */
	tooltips?: {
		/**
		* The tooltip of minimize button.
		* **The default is "Minimize"**
		*/
		minimize?: string
		/**
		 * The tooltip of maximize button.
		 * **The default is "Maximize"**
		 */
		maximize?: string
		/**
		 * The tooltip of restore button.
		 * **The default is "Restore Down"**
		 */
		restoreDown?: string
		/**
		 * The tooltip of close button.
		 * **The default is "Close"**
		 */
		close?: string
	},
	/**
	 * Enables or disables the blur option in titlebar.
	 * *The default is true*
	 */
	unfocusEffect?: boolean;
}