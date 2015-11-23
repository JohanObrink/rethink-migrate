var config = require('../database.json'),
  _ = require('lodash'),
  r, connection, toArray;

function connect() {
  return r.connect(_.omit(config, ['db']))
    .then(function (conn) {
      connection = conn;
      helper.connection = connection;
    });
}

function cleanup() {
  return r.dbList()
    .run(connection)
    .then(toArray)
    .then(function (dbs) {
      return Promise.all(_.intersection(dbs, [config.db, '_another_db'])
        .map(function (db) {
          return r.dbDrop(db).run(connection);
        }));
    });
}

function empty() {
  return r.tableList().run(connection)
    .then(toArray)
    .then(function (tables) {
      return Promise.all(tables.map(function (table) {
        return (table === '_migrations') ?
          r.table(table).delete().run(connection) :
          r.tableDrop(table).run(connection);
      }));
    });
}

function reset() {
  delete process.env.db;
  helper.connection.use(config.db);
}

var helper = {
  connect: connect,
  cleanup: cleanup,
  empty: empty,
  reset: reset
};

module.exports = function init(_r, _toArray) {
  r = _r;
  toArray = _toArray;
  return helper;
};
