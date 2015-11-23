var chai = require('chai'),
  expect = chai.expect,
  migrate = require(process.cwd() + '/lib/migrate'),
  toArray = migrate.toArray,
  config = require('../database.json'),
  _ = require('lodash');

var r = migrate.r({driver: 'rethinkdbdash', pool: false, cursor: false}),
  toArray = migrate.toArray,
  helper = require('./helper')(r, toArray);

describe('rethinkdbdash {pool: false, cursor: false}', function () {

  describe('migrate up', function () {
    this.timeout(15000);

    var options;

    before(function () {
      return helper.connect().then(helper.cleanup);
    });
    after(helper.cleanup);

    beforeEach(function () {
      options = {
        root: process.cwd() + '/test',
        all: true,
        pool: false,
        cursor: false,
        logLevel: 'error'
      };
      helper.reset();
    });
    afterEach(helper.cleanup);

    it('creates tables', function () {
      return migrate.up(options)
        .then(function () {
          return r.tableList().run(helper.connection)
            .then(function (tables) {
              var expected = ['_migrations', 'companies', 'employees'];
              expect(tables.join()).to.equal(expected.join());
            });
        });
    });
    it('uses ENV', function () {
      var db = '_another_db';
      process.env.db = db;
      helper.connection.use(db);

      return migrate.up(options)
        .then(function () {
          return r.tableList().run(helper.connection)
            .then(function (tables) {
              var expected = ['_migrations', 'companies', 'employees'];
              expect(tables.join()).to.equal(expected.join());

              return r.dbDrop(db).run(helper.connection);
            });
        });
    });
    it('inserts data', function () {
      return migrate.up(options)
        .then(function () {
          return r.table('companies')
            .merge(function (company) {
              return {
                employees: r.table('employees')
                  .filter(function (employee) {
                    return employee('companyId').eq(company('id'));
                  })
                  .pluck('name')
                  .orderBy('name')
                  .coerceTo('ARRAY')
              };
            })
            .run(helper.connection);
        })
        .then(toArray)
        .then(function (companies) {
          var expected = [
            {
              id: 'acme',
              name: 'ACME',
              employees: [
                {name: 'Road Runner'},
                {name: 'Wile E Coyote'}
              ]
            },
            {
              id: 'shield',
              name: 'S.H.I.E.L.D',
              employees: [
                {name: 'Natalia Alianovna Romanova'},
                {name: 'Robert Bruce Banner'},
                {name: 'Steve Rogers'},
                {name: 'Tony Stark'}
              ]
            }
          ];
          expect(companies).to.eql(expected);
        });
    });
  });
});