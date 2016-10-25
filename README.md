# generic-data-server

An in-memory database that implements [document-database-if](https://github.com/psnider/document-database-if).

This database is for test only, as it doesn't persist.

This is used in [people-service](https://github.com/psnider/people-service)

Note that the type declaration file is in the root,
and it is referenced in the typings field of package.json.
I haven't figured out how to both reference it this way in the code that's being compiled,
and in the running code,
since the running code expects it to be in its install location, under node_modules.

To get around this, **bin/install-in-node_modules.sh** creates a local npm compatible module.

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

I haven't figured out how to get source-level debugging to work in MicroSoft Visual Studio Code.
So until then:

- place breakpoints in the generated javascript files
- start the debugger, and select Mocha
- go!

