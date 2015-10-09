var path = require('path'),
  moment = require('moment'),
  fs = require('ts-fs-promise');

function create(name, root) {
  root = path.join(root || process.cwd(), 'migrations');
  var templatepath = path.join(__dirname, '../template.js');
  var filename = moment().format('YYYYMMDDHHmmss') + '-' + name + '.js';
  var filepath = path.join(root, filename);
  return fs
    .copy(templatepath, filepath)
    .then(function () {
      return filepath
    });
}

module.exports = create;