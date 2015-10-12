var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  path = require('path'),
  r = require('rethinkdb'),
  migrate = require(process.cwd() + '/lib/migrate'),
  configs = require('../database.json'),
  _ = require('lodash');

describe('rethink-migrate up', function () {
  this.timeout(15000);

  var options, connection;

  before(function () {
    return r.connect(configs.dev)
      .then(function (_connection) {
        connection = _connection;
      });
  });
  beforeEach(function () {
    sinon.stub(process, 'exit');
    options = {
      root: process.cwd() + '/test',
      all: true
    };
    return migrate.down(options);
  });
  afterEach(function () {
    process.exit.restore();
  });
  after(function () {
    return r.dbDrop(configs.dev.db).run(connection);
  });

  it('creates tables', function () {
    return migrate.up(options)
      .then(function () {
        return r.tableList().run(connection)
          .then(function (cursor) { return cursor.toArray(); })
          .then(function (tables) {
            var expected = ['_migrations', 'companies', 'employees'];
            expect(tables.join()).to.equal(expected.join());
          });
      });
  });
  xit('inserts data', function () {
    return migrate.up(options)
      .then(function () {
        return r.table('employees')
          .merge(function (company) {
            return {
              employees: r.table('employees').filter(function (employee) {
                  return employee('companyId').eq(company('id'));
                })
                .coerceTo('ARRAY')
            }
          })
          .run(connection);
      })
      .then(function (cursor) { return cursor.toArray(); })
      .then(function (companies) {
        console.log('companies', companies);
        var expected = [
          {
            id: 'acme',
            name: 'ACME',
            employees: [
              {name: 'Wile E Coyote'},
              {name: 'Road Runner'}
            ]
          },
          {
            id: 'shield',
            name: 'S.H.I.E.L.D',
            employees: [
              {name: 'Tony Stark'},
              {name: 'Steve Rogers'},
              {name: 'Natalia Alianovna Romanova'},
              {name: 'Robert Bruce Banner'}
            ]
          }
        ];
        expect(companies).to.eql(expected);
      });
  });
});