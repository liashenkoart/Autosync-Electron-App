const { BrowserWindow } = require('electron');

function createAppWindow () {
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      devTools: true,
      nodeIntegration: true,
      enableRemoteModule: true
    },
  });

  win.loadFile('renderers/index.html');
  win.webContents.openDevTools()
  win.removeMenu()
  win.on('closed', () => {
    win = null;
  });
}

module.exports = createAppWindow;