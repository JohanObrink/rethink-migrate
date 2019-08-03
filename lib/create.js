const path = require('path');
const moment = require('moment');
const fs = require('fs').promises

function create(name, root) {
  root = path.join(root || process.cwd(), 'migrations');
  var templatepath = path.join(__dirname, '../template.js');
  var filename = moment().format('YYYYMMDDHHmmss') + '-' + name + '.js';
  var filepath = path.join(root, filename);
  return fs
    .copyFile(templatepath, filepath)
    .then(function () {
      return filepath;
    });
}

module.exports = create;
