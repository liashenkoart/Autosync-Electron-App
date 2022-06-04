const { BrowserWindow } = require('electron');
const authService = require('../services/auth-service');
const createAppWindow = require('../main/app-process');
const { ipcMain } = require('electron')

let win = null;

function createAuthWindow () {
  destroyAuthWin();

  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });

  win.loadFile('renderers/login-options.html');
  // win.removeMenu();

  ipcMain.on('landlogBtnOptionClick', function (event, arg) {
    win.loadURL(authService.getAuthenticationURL());
    const { session: { webRequest } } = win.webContents;

    const filter = {
      urls: [
        'http://localhost/callback*'
      ]
    };

    webRequest.onBeforeRequest(filter, async ({ url }) => {
      await authService.loadTokens(url);
      createAppWindow();
      return destroyAuthWin();
    });

    win.on('authenticated', () => {
      destroyAuthWin();
    });
  });

  win.on('closed', () => {
    win = null;
  });
}

function destroyAuthWin () {
  if (!win) return;
  win.close();
  win = null;
}

function createLogoutWindow () {
  const logoutWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });

  logoutWindow.loadURL(authService.getLogOutUrl());

  logoutWindow.on('ready-to-show', async () => {
    logoutWindow.close();
    await authService.logout();
  });
}

module.exports = {
  createAuthWindow: createAuthWindow,
  createLogoutWindow: createLogoutWindow
};
