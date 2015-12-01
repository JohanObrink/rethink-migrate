var seed = require('rethink-migrate').seed;

exports.up = function (r, connection) {
  return seed
    .read('<%= name %>')
    .then(function (tables) {
      return seed.insert(tables, r, connection);
    });
};

exports.down = function (r, connection) {
  return seed
    .read('<%= name %>')
    .then(function (tables) {
      return seed.delete(tables, r, connection);
    });
};