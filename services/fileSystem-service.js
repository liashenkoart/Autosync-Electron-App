const fs = require('fs');
const crypto = require('crypto');


exports.getFiles = (folderPath) => {
    return new Promise((resolve, reject) => {
        fs.readdir(folderPath, async (err, files) => {
            if (err) return resolve(console.log(err));

            const fileDataPromises = files.map(async (fileName) => ({
                name: fileName,
                checksum: await getFileChecksum(folderPath + fileName)
            }))

            resolve(await Promise.all(fileDataPromises));
        });
    });
}

function getFileChecksum(path) {
    return new Promise((resolve, reject) => {
        checksumFile(path, {
            algorithm: 'md5',
            encoding: 'base64'
        }, (err, hash) => {
            if (err) return reject(err);
            return resolve(hash)
        })
    })
}


function checksumFile (filename, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
  
    options || (options = {})
    if (!options.algorithm) options.algorithm = 'sha1'
  
    fs.stat(filename, function (err, stat) {
      if (!err && !stat.isFile()) err = new Error('Not a file')
      if (err) return callback(err)
      
      
      var hash = crypto.createHash(options.algorithm)
        , fileStream = fs.createReadStream(filename)
  
      if (!hash.write) {
  
        fileStream.on('data', function (data) {
          hash.update(data)
        })
  
        fileStream.on('end', function () {
          callback(null, hash.digest('base64'))
        })
  
      } else {
  
        hash.setEncoding('base64')
        fileStream.pipe(hash, { end: false })
  
        fileStream.on('end', function () {
          hash.end()
          callback(null, hash.read())
        })
  
      }
    })
  }