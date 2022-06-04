const { BrowserWindow } = require('electron');

function createAppWindow () {
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });

  win.loadFile('renderers/index.html');
  win.removeMenu()
  win.on('closed', () => {
    win = null;
  });
}

module.exports = createAppWindow;