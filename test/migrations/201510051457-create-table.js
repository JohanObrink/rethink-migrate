var r = require('rethinkdb');

exports.up = function (connection) {
  return r.tableCreate('foo').run(connection)
    .then(function () {
      return r.tableCreate('bar').run(connection);
    });
};

exports.down = function (connection) {
  return r.tableDrop('foo').run(connection)
    .then(function () {
      return r.tableDrop('bar').run(connection);
    });
};