var r = require('rethinkdb');

exports.up = function (connection) {
  return Promise.all([
    r.tableCreate('foo').run(connection),
    r.tableCreate('bar').run(connection)
  ])
  .then(function () {
    return Promise.all([
      r.table('foo').indexCreate('hello').run(connection),
      r.table('bar').indexCreate('name').run(connection)
    ]);
  })
  .then(function () {
    return Promise.all([
      r.table('foo').indexWait().run(connection),
      r.table('bar').indexWait().run(connection)
    ]);
  });
};

exports.down = function (connection) {
  return Promise.all([
    r.tableDrop('foo').run(connection),
    r.tableDrop('bar').run(connection)
  ]);
};