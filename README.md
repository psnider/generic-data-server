# generic-data-server

An in-memory database that implements [document-database-if](https://github.com/psnider/document-database-if).

This database is for test only, as it doesn't persist.

This is used in [people-service](https://github.com/psnider/people-service)

## build
```
npm run build
```

## test
```
npm run test
```

If you have trouble with the tests,
make sure that you are not already running a mongod instance on port 27016.
