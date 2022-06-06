const { app, BrowserWindow } = require('electron');
const Shell = require('node-powershell');
const fs = require('fs');
const os = require('os');
const qs = require('querystring');

const axios = require('axios');
const path = require('path');
const rimraf = require('rimraf')
const hasha = require('hasha');
const streamLength = require('stream-length')

const authService = require('./auth-service');
const constants = require('../lib/constants');
const { resolve } = require('path');

const apiDomain = process.env.ApiDomain;

const baseURL = `https://${apiDomain}/v2/`;

const axiosInstance = axios.create({ baseURL });

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
  console.log(error);
  if (error.response.status === 401 && originalRequest.url.endsWith('/connect/token')) {
    return Promise.reject(error);
  }
  if (error.response.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;
    await authService.refreshTokens();
    return axiosInstance(originalRequest);
  }

  return Promise.reject(error.response.data.message);
})

function loadSites() {
  return axiosInstance.get('/sites').then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getUserInfo() {
  return axiosInstance.get('/me').then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getBuckets(resourceOwnerId) {
  const params = {
    resource_owner_id: resourceOwnerId
  }

  return axiosInstance.get(`/file_storage/buckets?${qs.stringify(params)}`).then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getResourceOwners() {
  return axiosInstance.get('/resource_owners').then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getFolder(bucket, key) {
  const params = {
    key: key,
    recursive: true
  };
  return axiosInstance.get(`/file_storage/buckets/${bucket}/nodes?${qs.stringify(params)}`).then(response => {
    console.log(response);
    return response.data;
  })
    .catch(error => {
      console.log(error);
      resolve();
    });
}

function getFiles(bucket, parentNodeId) {
  const params = {
    parent_node_id: parentNodeId,
    order_by: 'created_at',
    order: 'desc',
    limit: 20
  };

  return axiosInstance.get(`/file_storage/buckets/${bucket}/nodes?${qs.stringify(params)}`).then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getCurrentDateTimeString(date) {
  return Date.parse(date.toDateString());
}

function uploadFile(folderPath, fileName, fileChecksum, bucketId, key, parentNodeId) {
  return new Promise(async (resolve, reject) => {
    try {
      const params = {
        key: key + fileName,
        checksum: fileChecksum,
      };

      const file = new LL_File(folderPath + fileName);

      axiosInstance({
        url: `/file_storage/buckets/${bucketId}/upload`,
        method: 'PUT',
        headers: {
          "Content-Length": await file.length()
        },  
        data: file.fs,
        params: {
          name: fileName,
          parent_key: key,
          checksum: fileChecksum,
          force: true
        }
      }).then(res => resolve(res))
        .catch(err => resolve(err));


    } catch (err) {
      console.log(err);
      resolve(err);
    }
  });
}

class LL_File {
  constructor(path) {
    this.path = path;
    this.fs = fs.createReadStream(path);
  }

  async length() {
    return await streamLength(fs.createReadStream(this.path))
  }
}

function removeExpireLogFiles() {
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
  getFiles,
  getFolder,
  getCurrentDateTimeString,
  removeExpireLogFiles,
  getResourceOwners,
  uploadFile
}