var r,
  fs = require('ts-fs-promise'),
  path = require('path'),
  chalk = require('chalk'),
  nconf = require('nconf'),
  _ = require('lodash');

require("dotenv").load({ path: "./.env-defaults" });

var MIGRATION_TABLE_NAME = '_migrations';

var levels = [
  'debug',
  'info',
  'warning',
  'error',
  'none'
];
var logLevel, autoToArray, requiresWait;

function requireRethink(options) {
  if(r) { return r; }

  var modules = process.cwd() + '/node_modules/';
  var driver = options.driver;

  if(!driver) {
    try {
      fs.statSync(modules + 'rethinkdbdash');
      driver = 'rethinkdbdash';
    } catch(err) {
      try {
        fs.statSync(modules + 'rethinkdb');
        driver = 'rethinkdb';
      } catch(err) {
        logError('No rethinkdb driver installed locally.');
        logError('Run ' + chalk.cyan('npm install --save rethinkdbdash'));
        logError('...or ' + chalk.cyan('npm install --save rethinkdbdash'));
      }
    }
  }
  if(driver === 'rethinkdbdash') {
    autoToArray = options.cursor || true;
    requiresWait = true;
    r = require(modules + 'rethinkdbdash')(options);
  } else {
    autoToArray = false;
    r = require(modules + 'rethinkdb');
  }
  return r;
}

function toArray(cursor) {
  return autoToArray ? cursor : cursor.toArray();
}

// Shim Promise for older versions of Node
if('function' !== typeof global.Promise) {
  global.Promise = require('promise');
}

function wait(connection, options) {
  if(!requiresWait) { return; }
  debug('Waiting for', MIGRATION_TABLE_NAME, 'to be ready for writes');
  return r.wait([{waitFor: 'ready_for_writes', timeout: options.timeout}]).run(connection);
}

/*
  Read config from
  - arguments
  - environment variables
  - /database.json
 */
function getConfig(root, env) {
  var defaults = require(path.join(root, 'database.json'));
  defaults = defaults[env] || {};
  nconf
    .env("_")
    .defaults(defaults);
  var config = {
    host: nconf.get("RETHINK:HOST"),
    port: nconf.get("RETHINK:PORT") || 28015,
    db: nconf.get("RETHINK:DB"),
    timeout: nconf.get("RETHINK:TIMEOUT") || 300,
    authKey: nconf.get("RETHINK:AUTHKEY")
  };
  logInfo('Using config:', chalk.yellow(JSON.stringify(config, null, 2)));
  return Promise.resolve(config);
}

/*
  Connect to db
  If db does not yet exist, create it
 */
function connectToDb(config) {

  r = requireRethink(config);

  return r.connect(_.omit(config, ['db']))
    .then(function (connection) {
      connection.on('close', function () {
        debug('Connection closed');
      });
      return r.dbList().run(connection)
        .then(function (dbs) {
          if(dbs.indexOf(config.db) === -1) {
            logInfo('Creating database', chalk.yellow(config.db));
            return r.dbCreate(config.db).run(connection);
          }
        })
        .then(function () {
          debug('Use', config.db);
          connection.use(config.db);
          return wait(connection, config);
        })
        .then(function () {
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
      return r.table(MIGRATION_TABLE_NAME)
        .orderBy({index: 'timestamp'})
        .run(connection)
        .then(toArray);
    });
}

var rxMigrationFile = /^\d{14}-.*\.js$/;
function filterMigrationFiles(file) {
  return file.match(rxMigrationFile);
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
      return files.filter(filterMigrationFiles);
    })
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
  var env = params.env || "default";
  var config;

  logInfo('Connecting to database');
  return getConfig(root, env)
    .then(function (_config) {
      config = _config;
      debug('config', JSON.stringify(config));
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
                    return migration.code.up(r, connection);
                  })
                  .then(function () {
                    return wait(connection, config);
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
    })
    .catch(function (error) {
      logError('Migration failed', error);
      throw error;
    });
}

/*
  Rollback one or all migrations
 */
function migrateDown(params) {
  params = params || {};
  logLevel = params.logLevel || 'info';
  var root = params.root || process.cwd();
  var env = params.env || "default";

  logInfo('Connecting to database');
  return getConfig(root, env)
    .then(function (config) {
      return connectToDb(config);
    })
    .then(function (connection) {
      logInfo('Connected');
      return getCompletedMigrations(connection)
        .then(function (completedMigrations) {
          if(!completedMigrations || !completedMigrations.length) {
            logWarning('No migrations to run');
            return;
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
                return migration.code.down(r, connection);
              })
              .then(function () {
                return r.table(MIGRATION_TABLE_NAME).get(migration.id).delete().run(connection);
              });
          }, Promise.resolve());
        });
    })
    .then(function () {
      logInfo('Migration successful');
    })
    .catch(function (error) {
      logError('Migration failed', error);
      throw error;
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

  console.error(chalk.red('[rethink-migrate] ') + txt);
  if(error) {
    console.error(error);
    if(error.stack) {
      console.error(error.stack);
    }
  }
}

module.exports = {
  up: migrateUp,
  down: migrateDown,
  r: requireRethink,
  toArray: toArray
};
