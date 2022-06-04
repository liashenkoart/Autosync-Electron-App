const { ipcRenderer, remote } = require('electron');
const { app } = require('electron').remote;
const dataService = remote.require('./services/data-service');
const constants = require('../lib/constants');
const Store = require('electron-store');
const _ = require('underscore');
const path = require('path');
const dayjs = require('dayjs');
const log = require('electron-log');
const $ = require('jquery');

const store = new Store();
let checkNewFileInterval = null;

store.set('log_id', dataService.getCurrentDateTimeString(new Date()))

_.map(store.store, function (value, key) {
    console.log(key, value);
    $(`#${key}`).attr('checked', value)
})

$('#launch_at_startup').on('click', function () {
    if ($(this).is(':checked')) {
        store.set($(this).attr('id'), true);
        ipcRenderer.send('enableAutoLaunch');
    } else {
        store.set($(this).attr('id'), false);
        ipcRenderer.send('disableAutoLaunch');
    }
})

$('#sync_when_start').on('click', function () {
    if ($(this).is(':checked')) {
        if (checkRequiredAllFields()) {
            store.set($(this).attr('id'), true);
        } else {
            disableSyncWhenStart();
        }
    } else {
        store.set($(this).attr('id'), false);
    }
})

function stopSyncProcess() {
    $('#btn-stop-sync').trigger('click')
}

function disableSyncWhenStart() {
    store.set($('#sync_when_start').attr('id'), false);
    $('#sync_when_start').prop('checked', false)
}

$('#btn-stop-sync').on('click', function () {
    disabledBtnSync();
    window.clearInterval(checkNewFileInterval);
})

$('#btn-sync').on('click', function (event) {
    event.preventDefault();
    if (checkRequiredAllFields()) {
        enableBtnSync();
        checkNewFileInterval = setInterval(checkNewFile, 5000);
    }
})

function checkRequiredAllFields() {
    let allRequired = true;
    if (!checkRequiredField('select-site') ||
        !checkRequiredField('select-bucket') ||
        !checkRequiredField('select-folder', false) ||
        !checkRequiredField('select-path-folder')) {
        allRequired = false;
        stopSyncProcess();
    }
    return allRequired
}

$('#select-site').on('change', function () {
    setStatusSelectBucket(true);
    if (checkRequiredField('select-site')) {
        loadBuckets();
    }
})

$('#select-site, #select-bucket, #select-folder').on('change', function () {
    if (!checkRequiredAllFields()) {
        stopSyncProcess();
    }
})

$().on('change', function () {
    checkRequiredField('select-folder', false)
})

function checkNewFile() {
    const bucketId = $('#select-bucket option:selected').val();
    const key = $('#select-folder').val();
    dataService.getFolder(bucketId, key).then((response) => {
        if (response) {
            console.log('getFolder', response);
            const parentNodeId = response.nodes[0].id
            console.log('checking new file...')
            uploadFiles(bucketId, parentNodeId)
        }
    })
}

function loadBuckets(isStartApp = false) {
    const siteId = $('#select-site option:selected').val();
    $('#select-bucket').find('option').remove().end().append("<option value='' selected='selected'>Select one</option>");
    dataService.getResourceOwners().then((response) => {
        const resourceOwners = response.resource_owners
        _.map(resourceOwners, function (resourceOwner) {
            if (siteId === resourceOwner.group_id) {
                dataService.getBuckets(resourceOwner.id).then((response) => {
                    const buckets = response.buckets
                    _.map(buckets, function (bucket) {
                        $('#select-bucket').append(new Option(bucket.name, bucket.id));
                        fillSelectedBucket(isStartApp);
                    })
                })
            }
        })
    })
}

$('#select-site, #select-bucket, #select-folder').on('change', function () {
    resetSelectedStore();
});

function resetSelectedStore() {
    const siteId = $('#select-site option:selected').val();
    const bucketId = $('#select-bucket option:selected').val();
    const key = $('#select-folder').val();
    const selected = {
        bucketId: bucketId,
        key: key,
        siteId: siteId,
        folderPath: store.get('selected').folderPath
    }
    store.set('selected', selected)
}

function uploadFiles(bucketId, parentNodeId) {
    dataService.getFiles(bucketId, parentNodeId).then((response) => {
        const nodes = filterFilesByType(response.nodes);
        let willOpenFile = false;
        let newestFileCreatedAt = null;
        _.map(nodes, function (node, index) {
            if (!node.is_directory && node.file.size > 0 && checkIsNewFile(node.created_at)) {
                logMessage(`New file is found: ${node.name}`);
                if (index === 0) {
                    // first file is the newest
                    willOpenFile = true;
                    newestFileCreatedAt = node.created_at;
                }

                // dataService.downloadFile(bucketId, node.id, node.name, willOpenFile)
            }
        })

        if (newestFileCreatedAt) {
            store.set('lastDownloadedFileCreatedAt', newestFileCreatedAt);
        }
    })
}

function filterFilesByType(fileArray) {
    const newListFiles = []
    _.map(fileArray, function (node) {
        const fileType = path.extname(node.name)
        if (fileType === constants.ACCEPT_FILE_TYPE) {
            newListFiles.push(node)
        }
    })
    return newListFiles;
}

function checkIsNewFile(newFileCreatedAt) {
    const lastDownloadedFileCreatedAt = store.get('lastDownloadedFileCreatedAt')

    return !lastDownloadedFileCreatedAt || parseInt(newFileCreatedAt) > parseInt(lastDownloadedFileCreatedAt);
}

function fillData() {
    if (store.has('selected')) {
        const selected = store.get('selected');
        $('#select-site').val(selected.siteId);
        $('#select-folder').val(selected.key);
        $('#select-path-folder').val(selected.folderPath);
        loadBuckets(true);
    }
}

function checkRequiredField(elementId, isSelectField = true) {
    let required = true;
    let value;
    if (isSelectField) {
        value = $(`#${elementId} option:selected`).val();
    } else {
        value = $(`#${elementId}`).val();
    }

    if (value === '') {
        required = false;
    }
    return required
}

function enableBtnSync() {
    $('#btn-sync, #btn-stop-sync').removeClass('btn-active');
    $('#btn-sync').addClass('btn-active');
}

function disabledBtnSync() {
    $('#btn-sync, #btn-stop-sync').removeClass('btn-active');
    $('#btn-stop-sync').addClass('btn-active');
}

function syncWhenStart() {
    if (store.get('sync_when_start')) {
        if (checkRequiredAllFields()) {
            enableBtnSync();
            checkNewFileInterval = setInterval(checkNewFile, 5000);
        } else {
            stopSyncProcess();
        }
    } else {
        stopSyncProcess();
    }
}

function fillSelectedBucket(isStartApp = false) {
    if (store.has('selected')) {
        setStatusSelectBucket(false)
        const selected = store.get('selected');
        $('#select-bucket').val(selected.bucketId);
    }
    if (isStartApp) {
        syncWhenStart();
    }
}

function setStatusSelectBucket(value) {
    $('#select-bucket').attr('disabled', value);
}

function logMessage(message) {
    const dateString = dayjs().format('YYYY/MM/DD HH:mm');
    const logMsg = `${dateString} ${message}`
    const logsFolder = app.getPath('logs');
    log.info(logMsg);
    log.transports.file.file = logsFolder + `/log_${store.get('log_id')}.log`;
    $('#logTextarea').val(function (index, old) { return logMsg + '\n' + old; });
}

$('#logout').on('click', () => {
    ipcRenderer.send('logoutButtonClicked');
})

ipcRenderer.on('logged-out', () => {
    remote.getCurrentWindow().close();
})

dataService.getUserInfo().then((response) => {
    const userName = `${response.family_name} ${response.given_name}`
    $('#current-user-name').text(userName)
})

ipcRenderer.on('downloadDone', (event, fileName) => {
    logMessage(`${fileName} has been downloaded`);
})

ipcRenderer.on('downloadingFile', (event, fileName) => {
    logMessage(`Downloading ${fileName}`);
})

dataService.loadSites().then((response) => {
    const sites = response.sites
    _.map(sites, function (site) {
        $('#select-site').append(new Option(site.name, site.id))
    })
    fillData();
});

/**
 * Select file
 */
const fileSelect = document.getElementById('select-synced-folder');
const filePathInput = document.getElementById('select-path-folder');

fileSelect.addEventListener('change', () => {
    let path = fileSelect.files[0].path;
    filePathInput.value = getFolderPath(path);

    store.set('selected', {
        bucketId: store.get('selected').bucketId,
        key: store.get('selected').key,
        siteId: store.get('selected').siteId,
        folderPath: getFolderPath(path)
    });
})

function getFolderPath(fullPath) {
    const pathParts = fullPath.split('\\');
    const fileName = pathParts[pathParts.length - 1];
    return fullPath.replace(new RegExp(fileName + '$'), '');
}