const { app, BrowserWindow } = require('electron');
const Shell = require('node-powershell');
const fs = require('fs');
const os = require('os');
const qs = require('querystring');

const axios = require('axios');
const path = require('path');
const rimraf = require('rimraf')
const FormData = require('form-data');

const authService = require('./auth-service');
const constants = require('../lib/constants');
const uploader = require('./uploader');

const apiDomain = process.env.ApiDomain;

const isWindow = (os.platform() === 'win32');

const win = BrowserWindow.getFocusedWindow();

const ps = new Shell({
  executionPolicy: 'Bypass',
  noProfile: true
});

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
  console.log(error.response.data.errors);
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
    key: key
  };
  return axiosInstance.get(`/file_storage/buckets/${bucket}/nodes?${qs.stringify(params)}`).then(response => response.data)
    .catch(error => {
      console.log(error);
    });
}

function getFiles(bucket, parentNodeId) {
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

function getCurrentDateTimeString(date) {
  return Date.parse(date.toDateString());
}

function uploadFile(folderPath, fileName, fileChecksum, bucketId, key, parentNodeId) {
  return new Promise((resolve, reject) => {
    try {
      //   fs.readFile(folderPath + fileName, async (err, fileData) => {
      //     if (err) {
      //       console.log(err);
      //       return resolve(err);
      //     }

      //     let formData = new FormData();
      //     formData.append(fileName, fileData);

      //     formData.getLength((err, length) => {
      //       const checksum = fileChecksum.replace('/', '%2F').replace('+', '%2B')

      //       axiosInstance({
      //       url: `/file_storage/buckets/${bucketId}/upload`,
      //       method: 'PUT',
      //       headers: {
      //         ...formData.getHeaders(),
      //         "Content-Length": length
      //       },
      //       data: formData,
      // params: {
      //   key: key + fileName,
      //   checksum: fileChecksum,
      // }
      //     }).then(res => resolve(res))
      //         .catch(err => resolve(err));
      //   });
      // });
      const params = {
        key: key + fileName,
        checksum: fileChecksum,
      };

      const url = baseURL + `file_storage/buckets/${bucketId}/upload?${qs.stringify(params)}`;

      fs.readFile(folderPath + fileName, (err, file) => {
        uploader()
          .onProgress(({ loaded, total }) => {
            const percent = Math.round(loaded / total * 100 * 100) / 100;
          })
          .options({
            chunkSize: 10 * 1024 * 1024,
            threadsQuantity: 1,
            url,
          })
          .send(file)
          .end((error, data) => {
            if (error) {
              console.log("Error", error);
              return resolve();
            }
          });
      });


    } catch (err) {
      console.log(err);
      resolve(err);
    }
  });
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
