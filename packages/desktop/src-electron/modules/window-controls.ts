/* eslint-disable no-undef */
/**
 * Window events handler (for custom navbar)
 */
import { BrowserWindow, app, ipcMain } from 'electron';

const notifyWindowMaximized = (window: BrowserWindow) => {
  window.webContents.send(
    'window/is-maximized',
    process.platform === 'darwin'
      ? window.isFullScreen()
      : window.isMaximized(),
  );
};

// notify client with window active state
const notifyWindowActive = (window: BrowserWindow, state: boolean) => {
  window.webContents.send('window/is-active', state);
};

const init = ({ mainWindow, store }: Dependencies) => {
  const { logger } = global;

  if (process.platform === 'darwin') {
    // macOS specific window behavior
    // it is common for applications and their context menu to stay active until the user quits explicitly
    // with Cmd + Q or right-click > Quit from the context menu.

    // restore window after click on the Dock icon
    app.on('activate', () => {
      logger.info('window-control', 'Showing main window on activate');
      mainWindow.show();
    });
    // hide window to the Dock
    // this event listener will be removed by app.on('before-quit')
    mainWindow.on('close', (event) => {
      logger.info(
        'window-control',
        'Hiding the app after the main window has been closed',
      );

      event.preventDefault();
      mainWindow.hide();
    });
  } else {
    // other platform just kills the app
    app.on('window-all-closed', () => {
      logger.info(
        'window-control',
        'Quitting app after all windows have been closed',
      );
      app.quit();
    });
  }

  mainWindow.on('page-title-updated', (evt) => {
    // prevent updating window title
    evt.preventDefault();
  });
  mainWindow.on('maximize', () => {
    logger.debug('window-control', 'Maximize');
    notifyWindowMaximized(mainWindow);
  });
  mainWindow.on('unmaximize', () => {
    logger.debug('window-control', 'Unmaximize');
    notifyWindowMaximized(mainWindow);
  });
  mainWindow.on('enter-full-screen', () => {
    logger.debug('window-control', 'Enter full screen');
    notifyWindowMaximized(mainWindow);
  });
  mainWindow.on('leave-full-screen', () => {
    logger.debug('window-control', 'Leave full screen');
    notifyWindowMaximized(mainWindow);
  });
  mainWindow.on('moved', () => {
    logger.debug('window-control', 'Moved');
    notifyWindowMaximized(mainWindow);
  });
  mainWindow.on('focus', () => {
    logger.debug('window-control', 'Focus');
    notifyWindowActive(mainWindow, true);
  });
  mainWindow.on('blur', () => {
    logger.debug('window-control', 'Blur');
    notifyWindowActive(mainWindow, false);
  });

  ipcMain.on('window/close', () => {
    logger.debug('window-control', 'Close requested');
    // Keeping the devtools open might prevent the app from closing
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    }
    // store window bounds on close btn click
    const winBound = mainWindow.getBounds() as WinBounds;
    store.setWinBounds(winBound);
    mainWindow.close();
  });
  ipcMain.on('window/minimize', () => {
    logger.debug('window-control', 'Minimize requested');
    mainWindow.minimize();
  });
  ipcMain.on('window/maximize', () => {
    logger.debug('window-control', 'Maximize requested');
    if (process.platform === 'darwin') {
      mainWindow.setFullScreen(true);
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window/unmaximize', () => {
    logger.debug('window-control', 'Unmaximize requested');
    if (process.platform === 'darwin') {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.unmaximize();
    }
  });
  ipcMain.on('window/focus', () => {
    logger.debug('window-control', 'Focus requested');
    app.focus({ steal: true });
  });

  ipcMain.on('client/ready', () => {
    logger.debug('window-control', 'Client ready');
    notifyWindowMaximized(mainWindow);
  });

  app.on('before-quit', () => {
    // store window bounds on cmd/ctrl+q
    const winBound = mainWindow.getBounds() as WinBounds;
    store.setWinBounds(winBound);
  });
};

export default init;
