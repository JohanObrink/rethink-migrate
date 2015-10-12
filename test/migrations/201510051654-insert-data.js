var r = require('rethinkdb');

exports.up = function (connection) {
  return Promise.all([
    r.table('companies').insert([
      {id: 'acme', name: 'ACME'},
      {id: 'shield', name: 'S.H.I.E.L.D'}
    ]).run(connection),
    r.table('employees').insert([
      {companyId: 'acme', name: 'Wile E Coyote'},
      {companyId: 'acme', name: 'Road Runner'},
      {companyId: 'shield', name: 'Tony Stark'},
      {companyId: 'shield', name: 'Steve Rogers'},
      {companyId: 'shield', name: 'Natalia Alianovna Romanova'},
      {companyId: 'shield', name: 'Robert Bruce Banner'}
    ]).run(connection),
  ]);
};

exports.down = function (connection) {
  return Promise.all([
    r.table('companies').delete().run(connection),
    r.table('employees').delete().run(connection)
  ]);
};