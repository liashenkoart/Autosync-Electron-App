const { ipcRenderer } = require('electron');

const btnLoginOption = document.getElementById('landlog-login-option');

btnLoginOption.addEventListener('click', function () {
  ipcRenderer.send('landlogBtnOptionClick');
});