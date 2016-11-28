# generic-data-server

An in-memory database that implements [document-database-if](https://github.com/psnider/document-database-if).

This database is for test only, as it doesn't persist.

This is used in [people-service](https://github.com/psnider/people-service)

## problems
The tests use promisify-node, which has a bug when using es6 classes.  
See: https://github.com/nodegit/promisify-node/issues/26

If you are developing this package, then run ```npm run patch-promisify-node``` after you run npm install.

This does not affect the *generic-data-server* package itself.

## build
```
npm run build
```

## test
```
npm run test
```

This now checks for an existing *mongod* instance on port 27016.
If there is one, the test will fail, and you will see output from *npm* such as:
```
> ! lsof -i :27016
COMMAND   PID  USER   FD   TYPE            DEVICE SIZE/OFF NODE NAME
mongod  21830 peter    5u  IPv4 0xaa2260c34917de20      0t0  TCP *:27016 (LISTEN)
```
in which case, you should stop the other instance of mongod. Carefully!

## debugging
Often, it is enough to just enable logging, which is off by default to keep the test output clean.
In the *test-only* script, change DISABLE_LOGGING to:
```
DISABLE_LOGGING=false
```

You may use source-level debugging in MicroSoft Visual Studio Code by selecting launch config *Mocha* from debug mode.

