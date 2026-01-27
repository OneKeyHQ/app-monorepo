/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) AlexTorresDev. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */
import { WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from 'consts'
import { BrowserWindow } from 'electron'

export default (browserWindow: BrowserWindow) => {
	browserWindow.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT)

	browserWindow.on('enter-full-screen', () => {
		browserWindow.webContents.send('window-fullscreen', true)
	})

	browserWindow.on('leave-full-screen', () => {
		browserWindow.webContents.send('window-fullscreen', false)
	})

	browserWindow.on('focus', () => {
		browserWindow.webContents.send('window-focus', true)
	})

	browserWindow.on('blur', () => {
		browserWindow.webContents.send('window-focus', false)
	})

	browserWindow.on('maximize', () => {
		browserWindow.webContents.send('window-maximize', true)
	})

	browserWindow.on('unmaximize', () => {
		browserWindow.webContents.send('window-maximize', false)
	})
}