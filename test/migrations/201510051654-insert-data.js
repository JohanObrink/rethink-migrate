var r = require('rethinkdb');

exports.up = function (connection) {
  return r.table('foo').insert({hello: 'world'}).run(connection);
};

exports.down = function (connection) {
  return r.table('foo').delete().run(connection);
};