var r = require('rethinkdb');

exports.up = function (connection) {
  return Promise.all([
    r.table('foo').insert({hello: 'world', owner: 'johan'}).run(connection),
    r.table('bar').insert({name: 'johan'}).run(connection),
    r.table('bar').insert({name: 'johan'}).run(connection),
    r.table('bar').insert({name: 'sebastian'}).run(connection)
  ]);
};

exports.down = function (connection) {
  return r.table('foo').delete().run(connection);
};