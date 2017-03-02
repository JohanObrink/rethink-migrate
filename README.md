# rethink-migrate
A migration tool for rethink db

## Changes

- v2.0.0: major rev to how config works.  multiple breaking changes see updated README
- v1.3.0: fixed an exception if there are no migrations to revert on migrate down
- v1.2.2: changed signature for the migrations to support the rethinkdbdash driver

## Install

`npm install -g rethink-migrate`

## Setup

Install a rethinkdb driver:

`
npm install --save rethinkdb
`

or

`
npm install --save rethinkdbdash
`

## Configuration

### File
Create a ```database.json``` file in the root of your solution with the format:

```json
{
  "host": "localhost",
  "port": 28015,
  "db": "foo",
  "timeout": 60,
  "authKey": "bar"
}
```
### Environment Variables
(uses the dotenv module to pull in a .env if its there)

RETHINK_HOST=localhost <br/>
RETHINK_PORT=28015 <br/>
RETHINK_DB=foo <br/>
RETHINK_TIMEOUT=60 <br/>
RETHINK_AUTHKEY=bar <br/>

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

```rethink migrate up``` will run all outstanding up migrations.

```rethink migrate down``` will run one down migration.

```rethink migrate down --all``` will run all outstanding down migrations.

### Options

```rethink migrate up --root ./build``` will run all outstanding up migrations
  found in ./build/migrations with database.json in ./build.
```-r```can be used
  as an alias.

```rethink migrate up --logLevel debug``` will set logLevel to debug.
  Possible values are: debug | info | warning | error | none.
```-l```can be used as an alias.

##License

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
