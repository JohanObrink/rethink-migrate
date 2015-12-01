var migrate = require('./migrate'),
  seed = require('./seed');

module.exports = {
  up: migrate.up,
  down: migrate.down,
  r: migrate.r,
  toArray: migrate.toArray,
  seed: seed
};