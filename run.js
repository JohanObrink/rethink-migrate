var meow = require('meow'),
  migrate = require('./lib/migrate');
 
var cli = meow([
    'Run all up migrations:',
    '  $ rethink-migrate up',
    '',
    'Run one down migration:',
    '  $ rethink-migrate down',
    '',
    'Run all down migrations:',
    '  $ rethink-migrate down -a',
    '  $ rethink-migrate down --all',
    '',
    'Create a new migration script',
    '  $ rethink-migrate create create-database'
  ].join('\n'),
  {
    alias: {
        a: 'all'
    }
  });

var direction = cli.input[0];
var all = cli.flags.all;

migrate[direction](all);