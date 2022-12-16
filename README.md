# Testing sqlite wasm

## Setup

```sh
$ npm i
$ npm run dev
```

The web app has a UI to build up a medium sized DB, export the DB file, and run queries against it.

### Getting the DB from the browser into sqlite3’s CLI

1. Export the DB file from the browser
2. Open the DB file with sqlite3, to convert it to a sql dump:
    ```sh
    $ sqlite3
    > .open db.sqlite
    > .once db.sql
    > .dump
    > .quit
    ```
3. Open sqlite3 and read the sql into the in-memory DB, turn on timing:
    ```sh
    $ sqlite3
    > .read db.sql
    > .timer ON
    ```

## Basic speed test

Testing a count query, because it only returns a number so there won’t be any serialization / deserialization timing differences.

Query: `select count(*) from subitems where name like '%a%'`

An example run should look like:

| Browser | CLI |
| :- | :- |
| 181ms | 98ms |

### Why is the browser that much slower to run the same query on an in-memory DB?

My suspicion is that the .wasm file is not well behaved, and is calling into JS often.

To test, I found the imports provided to the `WebAssembly.instantiate()` function in the `sql___js.js` file and added a breakpoint to each to run a js expression and then auto-continue. The JS expression is to keep a counter:

```js
window.count = (window.count || 0) + 1
```

The imports in my prettified source in my browser start on line 1743 with `var Wc = { a:`

The last import function property is on line 2145 with `}, r: function(a, b, c, d) {`

I feel pretty good about this being the import object because on line 2024 one of the functions returns `2147483648` which is a very special number, and on line 1977 it returns `Date.now()` which is the current unix time. I could see these being useful for a set of imports pretending to be I/O related stuff.

I instrumented every one of these functions with the same expression from above to increment a global counter.

Running only the count-like query above in the browser incremented `window.count` up from `0` to `22245`.

## Current conclusion

It is my current supposition that the .wasm code is calling back into JS way too often to be comparable to the sqlite3 CLI or a native program linked to sqlite’s API. If a wasm API could be made where each exported function took everything it needed up front or there was a better initialization function that could pre-setup all the things that are about to be needed, then the .wasm could call back into js less, maybe not at all.
