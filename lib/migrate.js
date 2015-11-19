var r = require(process.cwd() + '/node_modules/rethinkdb'),
  fs = require('ts-fs-promise'),
  path = require('path'),
  chalk = require('chalk'),
  nconf = require('nconf'),
  _ = require('lodash');

var MIGRATION_TABLE_NAME = '_migrations';

var levels = [
  'debug',
  'info',
  'warning',
  'error',
  'none'
];
var logLevel;

// Shim Promise for older versions of Node
if('function' !== typeof global.Promise) {
  global.Promise = require('promise');
}

/*
  Read config from
  - arguments
  - environment variables
  - /database.json
 */
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

/*
  Connect to db
  If db does not yet exist, create it
 */
function connectToDb(config) {
  return r.connect(_.omit(config, ['db']))
    .then(function (connection) {
      connection.on('close', function () {
        debug('Connection closed');
      });
      return r.dbList().run(connection)
        .then(function (cursor) { return cursor.toArray(); })
        .then(function (dbs) {
          if(dbs.indexOf(config.db) === -1) {
            logInfo('Creating database', chalk.yellow(config.db));
            return r.dbCreate(config.db).run(connection);
          }
        })
        .then(function () {
          connection.use(config.db);
          return connection;
        });
    });
}

/*
  Check for existence of _migrations table
  If needed, create it
 */
function ensureMigrationsTable(connection) {
  return r.tableList().run(connection)
    .then(function (cursor) { return cursor.toArray(); })
    .then(function (tables) {
      if(tables.indexOf(MIGRATION_TABLE_NAME) === -1) {
        debug('Creating', MIGRATION_TABLE_NAME, 'table');
        return r.tableCreate(MIGRATION_TABLE_NAME).run(connection)
          .then(function () {
            debug('Creating', MIGRATION_TABLE_NAME, '"timestamp" index');
            return r.table(MIGRATION_TABLE_NAME).indexCreate('timestamp').run(connection);
          })
          .then(function () {
            debug('Waiting for', MIGRATION_TABLE_NAME, '"timestamp" index to resolve');
            return r.table(MIGRATION_TABLE_NAME).indexWait().run(connection);
          });
      }
    });
}

/*
  Get all migrations stored in _migrations table
 */
function getCompletedMigrations(connection) {
  debug('Read completed migrations');
  return ensureMigrationsTable(connection)
    .then(function () {
      return r.table(MIGRATION_TABLE_NAME).orderBy({index: 'timestamp'}).run(connection)
        .then(function (cursor) { return cursor.toArray(); });
    });
}

/*
  Compares completed migrations to files on disk
  Returns the migrations scripts with a timestamp newer than last
  completed migration in db.

  TODO: Change so that all non run migration scripts are returned
 */
function getMigrationsExcept(completedMigration, root) {
  debug('List migration files');
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
        debug('Requiring migration', migration.timestamp, migration.name);
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

/*
  Takes a list of migration file paths and requires them
 */
function requireMigrations(migrations, root) {
  return migrations.map(function (migration) {
    var filename = migration.timestamp + '-' + migration.name + '.js';
    var filepath = path.join(root, 'migrations', filename);
    debug('Requiring migration', migration.timestamp, migration.name);
    return _.merge(migration, {
      filename: filename,
      code: require(filepath)
    });
  });
}

/*
  Writes all run migrations to db

  TODO: update this on every migration run
 */
function updateMigrationTimestamps(migrations, connection) {
  return migrations.reduce(function (promise, migration) {
    return promise.then(function () {
      debug('Writing migration', migration.timestamp, migration.name, 'to', MIGRATION_TABLE_NAME, 'table');
      return r.table(MIGRATION_TABLE_NAME).insert(_.omit(migration, ['filename', 'code'])).run(connection);
    });
  }, Promise.resolve());
}

/*
  Run all new up migrations
 */
function migrateUp(params) {
  params = params || {};
  logLevel = params.logLevel || 'info';
  var root = params.root || process.cwd();

  logInfo('Connecting to database');
  return getConfig(root)
    .then(function (config) {
      return connectToDb(config);
    })
    .then(function (connection) {
      logInfo('Connected');
      return getCompletedMigrations(connection)
        .then(function (completedMigrations) {
          var latest = completedMigrations && completedMigrations.length && completedMigrations[completedMigrations.length -1];
          return getMigrationsExcept(latest, root)
            .then(function (migrations) {
              if(!migrations.length) {
                logInfo('No new migrations');
              }
              var transaction = migrations.reduce(function (promise, migration) {
                return promise
                  .then(function () {
                    logInfo(chalk.black.bgGreen(' ↑  up  ↑ '), migration.timestamp, chalk.yellow(migration.name));
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
      logInfo('Migration successful');
      process.exit(0);
    })
    .catch(function (error) {
      logError('Migration failed', error);
      process.exit(1);
    });
}

/*
  Rollback one or all migrations
 */
function migrateDown(params) {
  params = params || {};
  logLevel = params.logLevel || 'info';
  var root = params.root || process.cwd();

  logInfo('Connecting to database');
  return getConfig(root)
    .then(function (config) {
      return connectToDb(config);
    })
    .then(function (connection) {
      logInfo('Connected');
      return getCompletedMigrations(connection)
        .then(function (completedMigrations) {
          if(!completedMigrations || !completedMigrations.length) {
            logWarning('No migrations to run');
            return process.exit(0);
          }

          var migrationsToRollBack = (params.all) ? completedMigrations.reverse() : [completedMigrations[completedMigrations.length -1]];
          return requireMigrations(migrationsToRollBack, root);
        })
        .then(function (migrations) {
          if(!migrations) { return; }
          return migrations.reduce(function (promise, migration) {
            return promise
              .then(function () {
                logInfo(chalk.black.bgYellow(' ↓ down ↓ '), migration.timestamp, chalk.yellow(migration.name));
                return migration.code.down(connection);
              })
              .then(function () {
                return r.table(MIGRATION_TABLE_NAME).get(migration.id).delete().run(connection);
              });
          }, Promise.resolve());
        });
    })
    .then(function () {
      logInfo('Migration successful');
      process.exit(0);
    })
    .catch(function (error) {
      logError('Migration failed', error);
      process.exit(1);
    });
}

function debug() {
  if(levels.indexOf(logLevel) > levels.indexOf('debug')) { return; }

  var args = Array.prototype.slice.call(arguments);
  args.unshift(chalk.gray('[rethink-migrate]'));
  console.log(args.join(' '));
}

function logInfo() {
  if(levels.indexOf(logLevel) > levels.indexOf('info')) { return; }
  
  var args = Array.prototype.slice.call(arguments);
  args.unshift(chalk.blue('[rethink-migrate]'));
  console.log(args.join(' '));
}

function logWarning() {
  if(levels.indexOf(logLevel) > levels.indexOf('warning')) { return; }

  var args = Array.prototype.slice.call(arguments);
  args.unshift(chalk.yellow('[rethink-migrate]'));
  console.log(args.join(' '));
}

function logError(txt, error) {
  if(levels.indexOf(logLevel) > levels.indexOf('error')) { return; }

  console.error(chalk.red('[rethink-migrate] ' + txt));
  console.error(error);
  if(error.stack) {
    console.error(error.stack);
  }
}

module.exports = {
  up: migrateUp,
  down: migrateDown
};