const { ipcRenderer } = require('electron');

const loginButton = document.getElementById('login');

loginButton.addEventListener('click', function () {
  ipcRenderer.send('loginBtnClick');
});