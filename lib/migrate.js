var r = require(process.cwd() + '/node_modules/rethinkdb'),
  fs = require('ts-fs-promise'),
  path = require('path'),
  chalk = require('chalk'),
  nconf = require('nconf'),
  _ = require('lodash');

if('function' !== typeof global.Promise) {
  global.Promise = require('promise');
}

function getConfig(root) {
  nconf
    .argv()
    .env()
    .file({ file: path.join(root, 'database.json') });
  return Promise.resolve({
    host: nconf.get('host'),
    port: nconf.get('port'),
    db: nconf.get('db')
  });
}

function connectToDb(config) {
  return r.connect(_.omit(config, ['db']))
    .then(function (connection) {
      connection.on('close', function () {
        log('Connection closed');
      });
      return r.dbList().run(connection)
        .then(function (cursor) { return cursor.toArray(); })
        .then(function (dbs) {
          if(dbs.indexOf(config.db) === -1) {
            log('Creating database', chalk.yellow(config.db));
            return r.dbCreate(config.db).run(connection);
          }
        })
        .then(function () {
          connection.use(config.db);
          return connection;
        });
    });
}

function ensureMigrationsTable(connection) {
  return r.tableList().run(connection)
    .then(function (cursor) { return cursor.toArray(); })
    .then(function (tables) {
      if(tables.indexOf('_migrations') === -1) {
        return r.tableCreate('_migrations').run(connection)
          .then(function () {
            return r.table('_migrations').indexCreate('timestamp').run(connection);
          })
          .then(function () {
            return r.table('_migrations').indexWait().run(connection);
          });
      }
    });
}

function getCompletedMigrations(connection) {
  return ensureMigrationsTable(connection)
    .then(function () {
      return r.table('_migrations').orderBy({index: 'timestamp'}).run(connection)
        .then(function (cursor) { return cursor.toArray(); });
    });
}

function getMigrationsExcept(completedMigration, root) {
  var dir = path.join(root, 'migrations');
  return fs.readdir(dir)
    .then(function (files) {
      return files
        .map(function (filename) {
          var tsix = filename.indexOf('-');
          return {
            name: filename.substring(tsix + 1, filename.lastIndexOf('.')),
            timestamp: filename.substring(0, tsix),
            filename: filename
          };
        })
        .filter(function (migration) {
          return !completedMigration || migration.timestamp > completedMigration.timestamp;
        });
    })
    .then(function (migrations) {
      return Promise.all(migrations.map(function (migration) {
        var filepath = path.join(dir, migration.filename);
        return require(filepath);
      }))
      .then(function (codes) {
        return migrations.map(function (migration, ix) {
          return _.merge(migration, {code: codes[ix]});
        });
      });
    });
}

function getMigrations(migrations, root) {
  return migrations.map(function (migration) {
    var filename = migration.timestamp + '-' + migration.name + '.js';
    var filepath = path.join(root, 'migrations', filename);
    return _.merge(migration, {
      filename: filename,
      code: require(filepath)
    });
  });
}

function updateMigrationTimestamps(migrations, connection) {
  return migrations.reduce(function (promise, migration) {
    return promise.then(function () {
      return r.table('_migrations').insert(_.omit(migration, ['filename', 'code'])).run(connection);
    });
  }, Promise.resolve());
}

function migrateUp(params) {
  params = params || {};
  var root = params.root || process.cwd();

  log('Connecting to database');
  return getConfig(root)
    .then(function (config) {
      return connectToDb(config);
    })
    .then(function (connection) {
      log('Connected');
      return getCompletedMigrations(connection)
        .then(function (completedMigrations) {
          var latest = completedMigrations && completedMigrations.length && completedMigrations[completedMigrations.length -1];
          return getMigrationsExcept(latest, root)
            .then(function (migrations) {
              if(!migrations.length) {
                log('No new migrations');
              }
              var transaction = migrations.reduce(function (promise, migration) {
                return promise
                  .then(function () {
                    log(chalk.black.bgGreen(' ↑  up  ↑ '), migration.timestamp, chalk.yellow(migration.name));
                    return migration.code.up(connection);
                  });
              }, Promise.resolve());

              return transaction
                .then(function () {
                  return updateMigrationTimestamps(migrations, connection);
                });
            });
        });
    })
    .then(function () {
      log('Migration successful');
      process.exit(0);
    })
    .catch(function (error) {
      logError('Migration failed', error);
      process.exit(1);
    });
}

function migrateDown(params) {
  params = params || {};
  var root = params.root || process.cwd();

  log('Connecting to database');
  return getConfig(root)
    .then(function (config) {
      return connectToDb(config);
    })
    .then(function (connection) {
      log('Connected');
      return getCompletedMigrations(connection)
        .then(function (completedMigrations) {
          if(!completedMigrations || !completedMigrations.length) {
            log('No migrations to run');
            return process.exit(0);
          }

          var migrationsToRollBack = (params.all) ? completedMigrations.reverse() : [completedMigrations[completedMigrations.length -1]];
          return getMigrations(migrationsToRollBack, root);
        })
        .then(function (migrations) {
          return migrations.reduce(function (promise, migration) {
            return promise
              .then(function () {
                log(chalk.black.bgYellow(' ↓ down ↓ '), migration.timestamp, chalk.yellow(migration.name));
                return migration.code.down(connection);
              })
              .then(function () {
                return r.table('_migrations').get(migration.id).delete().run(connection);
              });
          }, Promise.resolve());
        });
    })
    .then(function () {
      log('Migration successful');
      process.exit(0);
    })
    .catch(function (error) {
      logError('Migration failed', error);
      process.exit(1);
    });
}

function log() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(chalk.blue('[rethink-migrate]'));
  console.log(args.join(' '));
}

function logError(txt, error) {
  console.error(chalk.red('[rethink-migrate] ' + txt));
  console.error(error);
}

module.exports = {
  up: migrateUp,
  down: migrateDown
};