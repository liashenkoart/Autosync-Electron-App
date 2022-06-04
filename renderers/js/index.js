const { ipcRenderer, remote } = require('electron');
const { app } = require('electron').remote;
const dataService = remote.require('./services/data-service');

/**
 * Select file
 */
const fileSelect = document.getElementById('select-synced-folder');
const filePathInput = document.getElementById('select-path-folder');

fileSelect.addEventListener('change', () => {
    let path = fileSelect.files[0].path;
    const pathParts = path.split('\\');
    const fileName = pathParts[pathParts.length - 1];
    filePathInput.value = path.replace(new RegExp(fileName + '$'), '');
})

/**
 * Show username
 */
dataService.getUserInfo().then((res) => {
    const userName = `${res.family_name} ${res.given_name}`
    document.getElementById('current-user-name').innerText = userName;
});

/**
 * Logout
 */
const logoutButton = document.getElementById('logout');
logoutButton.addEventListener('click', () => {
    ipcRenderer.send('logoutButtonClicked');
})

ipcRenderer.on('logged-out', () => {
    remote.getCurrentWindow().close();
})