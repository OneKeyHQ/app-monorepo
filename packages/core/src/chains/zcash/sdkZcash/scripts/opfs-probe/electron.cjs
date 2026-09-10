/* eslint-disable onekey/no-raw-error -- isolated synthetic storage verification */
const path = require('node:path');

const { app, BrowserWindow } = require('electron');
const [directory, mode] = process.argv.slice(2);
app.setPath('userData', path.join(directory, `profile-${mode}`));
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error')
      console.error(
        event.message
          .replace(/data:application\/wasm;base64,[A-Za-z0-9+/=]+/g, '[wasm]')
          .slice(0, 1500),
      );
  });
  try {
    await window.loadFile(path.join(directory, 'index.html'), {
      query: { mode },
    });
    const result = await window.webContents.executeJavaScript('window.result');
    console.log(JSON.stringify(result));
    app.exit(result.pass ? 0 : 1);
  } catch (error) {
    console.error(String(error));
    app.exit(1);
  }
});
