# rethink-migrate
A migration tool for rethink db

## Install

```npm install -g rethink-migrate```

## Setup

Create a ```database.json``` file in the root of your solution with the format:

```json
{
  "host": "localhost",
  "port": 28015,
  "db": "migrations"
}
```

You can also use environment variables or arguments to override.

## Create migration

```rethink-migrate create [migration name]```

For example: ```rethink-migrate create add-tables```

## Edit migration

Open the file ```./migrations/[timestamp]-[migration name].js```

Add the changes to be made. For example:

```javascript
var r = require('rethinkdb');

exports.up = function (connection) {
  return r.tableCreate('foo').run(connection);
};

exports.down = function (connection) {
  return r.tableDrop('foo').run(connection);
};
```
## Run migrations

```rethink migrate up``` will run all outstanding up migrations.

```rethink migrate down``` will run one down migration.

```rethink migrate down --all``` will run all outstanding down migrations.

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
