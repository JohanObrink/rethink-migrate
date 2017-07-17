# rethink-migrate
A migration tool for rethink db

## Version 1.2

Breaking change: In order to support rethinkdbdash, the format of the migrations has
been changed from
```exports.up = function (connection) {``` and ```exports.down = function (connection) {```
to
```exports.up = function (r, connection) {``` and ```exports.down = function (r, connection) {```

## Install

```npm install -g rethink-migrate```

## Setup

Install a rethinkdb driver:

```bash
npm install --save rethinkdb
```

or

```bash
npm install --save rethinkdbdash
```

Create a ```rethink-migrate-file.js``` with the format:
```javascript
module.exports = {
  "host": "localhost",
  "port": 28015,
  "db": "migrations",
  "discovery": true,
  "timeout": 60
}
```

Or if you prefere, you can create a ```database.json``` file in the root of your solution with the format:

```json
{
  "host": "localhost",
  "port": 28015,
  "db": "migrations",
  "discovery": true,
  "timeout": 60
}
```

Other, optional, parameters are ```authKey``` and ```ssl```.

You can also use environment variables or arguments to override.

The configuration precedence is:
 - arguments
 - environment variables
 - database.json
 - rethink-migrate-file.js

### Log levels

The default is info. This will log info, warnings and errors. Possible values for logLevel are "debug" | "info" | "warning" | "error" | "none".

## Create migration

```rethink-migrate create [migration name]```

For example: ```rethink-migrate create add-tables```

## Edit migration

Open the file ```./migrations/[timestamp]-[migration name].js```

Add the changes to be made. For example:

```javascript
exports.up = function (r, connection) {
  return r.tableCreate('foo').run(connection);
};

exports.down = function (r, connection) {
  return r.tableDrop('foo').run(connection);
};
```
## Run migrations

```rethink-migrate up``` will run all outstanding up migrations.

```rethink-migrate down``` will run one down migration.

```rethink-migrate down --all``` will run all outstanding down migrations.

### Options

```rethink migrate up --root ./build``` will run all outstanding up migrations
  found in ./build/migrations with database.json in ./build.
```-r```can be used
  as an alias.

```rethink migrate up --logLevel debug``` will set logLevel to debug.
  Possible values are: debug | info | warning | error | none.
```-l```can be used as an alias.

## Run tests

In order to run the tests, you must have a rethinkdb instance running. You can
either start it locally in you machine or use the `docker-compose up` command to
start a dockerized version of rethinkdb. In any case, you must set the IP of
your running rethinkdb instance as the `host` address in the file
`test/database.json` before running tests

Use `npm test` to actually run the test suite.

To run tests continually, use `gulp test watch`

# License

The MIT License (MIT)

Copyright (c) 2015 Johan Öbrink

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
