var r = require('rethinkdb');

exports.up = function (connection) {
  return Promise.all([
    r.tableCreate('companies').run(connection),
    r.tableCreate('employees').run(connection)
  ]);
};

exports.down = function (connection) {
  return Promise.all([
    r.tableDrop('companies').run(connection),
    r.tableDrop('employees').run(connection)
  ]);
};