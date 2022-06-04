require('dotenv').config()
const { app, ipcMain } = require('electron');
const AutoLaunch = require('auto-launch');
const path = require('path');

require('electron-reload')(__dirname, {
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
  hardResetMethod: 'quit'
});

const authProcess = require('./main/auth-process');
const createAppWindow = require('./main/app-process');
const authService = require('./services/auth-service');

const autoLaunch = new AutoLaunch({
  name: 'Auto Sync Win',
  path: app.getPath('exe')
});

async function showWindow () {
  try {
    await authService.refreshTokens();
    return createAppWindow();
  } catch (err) {
    authProcess.createAuthWindow();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', showWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.on('logoutButtonClicked', (event) => {
  authProcess.createLogoutWindow();
  authProcess.createAuthWindow();
  event.sender.send('logged-out');
});

ipcMain.on('enableAutoLaunch', (event) => {
  autoLaunch.isEnabled().then((isEnabled) => {
    if (!isEnabled) autoLaunch.enable();
  });
})

ipcMain.on('disableAutoLaunch', (event) => {
  autoLaunch.disable();
})
