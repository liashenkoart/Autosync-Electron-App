const { app, BrowserWindow } = require('electron');
const Shell = require('node-powershell');
const fs = require('fs');
const os = require('os');
const qs = require('querystring');

const axios = require('axios');
const path = require('path');
const rimraf = require('rimraf')

const authService = require('./auth-service');
const constants = require('../lib/constants');

const apiDomain = process.env.ApiDomain;

const isWindow = (os.platform() === 'win32');

const win = BrowserWindow.getFocusedWindow();

const ps = new Shell({
  executionPolicy: 'Bypass',
  noProfile: true
});

const axiosInstance = axios.create({
  baseURL: `https://${apiDomain}/v2/`
})

axiosInstance.interceptors.request.use(
  config => {
    const token = authService.getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config
  },
  error => {
    Promise.reject(error);
  }
)

axiosInstance.interceptors.response.use((response) => {
  return response;
}, async function (error) {
  const originalRequest = error.config;
  if (error.response.status === 401 && originalRequest.url.endsWith('/connect/token')) {
    return Promise.reject(error);
  }
  if (error.response.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;
    await authService.refreshTokens();
    return axiosInstance(originalRequest);
  }

  return Promise.reject(error);
})

function loadSites () {
  return axiosInstance.get('/sites').then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getUserInfo () {
  return axiosInstance.get('/me').then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getBuckets (resourceOwnerId) {
  const params = {
    resource_owner_id: resourceOwnerId
  }

  return axiosInstance.get(`/file_storage/buckets?${qs.stringify(params)}`).then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getResourceOwners () {
  return axiosInstance.get('/resource_owners').then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getFolder (bucket, key) {
  const params = {
    key: key
  };
  return axiosInstance.get(`/file_storage/buckets/${bucket}/nodes?${qs.stringify(params)}`).then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getFiles (bucket, parentNodeId) {
  const params = {
    parent_node_id: parentNodeId,
    order_by: 'created_at',
    order: 'desc',
    limit: 10
  };

  return axiosInstance.get(`/file_storage/buckets/${bucket}/nodes?${qs.stringify(params)}`).then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getCurrentDateTimeString (date) {
  return Date.parse(date.toDateString());
}

async function downloadFile (bucketId, nodeId, fileName, willOpenFile) {
  const downloadsFolder = app.getPath('downloads');

  if (!fs.existsSync(downloadsFolder)) {
    fs.mkdirSync(downloadsFolder);
  }

  const finalPath = `${downloadsFolder}/${fileName}`;
  const out = fs.createWriteStream(finalPath);

  win.webContents.send('downloadingFile', fileName)

  const response = await axiosInstance({
    url: `/file_storage/buckets/${bucketId}/download?node_id=${nodeId}`,
    responseType: 'stream'
  })

  response.data.pipe(out);

  return new Promise((resolve, reject) => {
    out.on('finish', () => {
      if (isWindow && willOpenFile) {
        ps.addCommand('taskkill /F /IM ARESS.exe');
        ps.invoke().catch(error => {});
        ps.addCommand(`start "${constants.PROGRAM_PATH}" "${finalPath}"`);
        ps.invoke();
      }
      win.webContents.send('downloadDone', fileName)
      resolve
    });

    out.on('error', () => {
      reject
    });
  })
}

async function uploadFile() {
  const downloadsFolder = app.getPath('downloads');

  const finalPath = `${downloadsFolder}/${fileName}`;
  const out = fs.createReadStream(finalPath);

  win.webContents.send('downloadingFile', fileName)
  ///v2/file_storage/buckets/:bucket_id/upload
  const response = await axiosInstance({
    url: `/file_storage/buckets/${bucketId}/upload?node_id=${nodeId}`,
    responseType: 'stream'
  })

  response.data.pipe(out);

  return new Promise((resolve, reject) => {
    out.on('finish', () => {
      if (isWindow && willOpenFile) {
        ps.addCommand('taskkill /F /IM ARESS.exe');
        ps.invoke().catch(error => {});
        ps.addCommand(`start "${constants.PROGRAM_PATH}" "${finalPath}"`);
        ps.invoke();
      }
      win.webContents.send('uploadDone', fileName)
      resolve
    });

    out.on('error', () => {
      reject
    });
  })
}

function removeExpireLogFiles () {
  const uploadsDir = './logs/';
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  fs.readdir(uploadsDir, function (err, files) {
    files.forEach(function (file, index) {
      fs.stat(path.join(uploadsDir, file), function (err, stat) {
        if (err) {
          return console.error(err);
        }
        const now = new Date().getTime();
        const endTime = new Date(stat.ctime).getTime() + constants.LOG_FILE_EXPIRE;
        if (now > endTime) {
          return rimraf(path.join(uploadsDir, file), function (err) {
            if (err) {
              return console.error(err);
            }
            console.log('successfully deleted');
          });
        }
      });
    });
  });
}

module.exports = {
  loadSites,
  getUserInfo,
  getBuckets,
  downloadFile,
  getFiles,
  getFolder,
  getCurrentDateTimeString,
  removeExpireLogFiles,
  getResourceOwners
}
