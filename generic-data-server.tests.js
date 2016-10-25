"use strict";
var HTTP_STATUS = require('http-status-codes');
var request = require('request');
var CHAI = require('chai');
var expect = CHAI.expect;
var express = require('express');
var pino = require('pino');
var promisify = require("promisify-node");
process.env.NODE_ENV = 'development-test';
var configure = require('configure-local');
var example_data_type_1 = require('./example-data-type');
var document_database_tests_1 = require('document-database-tests');
var generic_data_server_1 = require('generic-data-server');
var person_mongoose_schema_1 = require('./person.mongoose-schema');
var mongod_runner_1 = require('mongod-runner');
var enable_logging = (process.env.DISABLE_LOGGING == null) || ((process.env.DISABLE_LOGGING.toLowerCase() !== 'true') && (process.env.DISABLE_LOGGING !== '1'));
var log = pino({ name: 'generic-data-server.tests', enabled: enable_logging });
// test programs should set the configuration of people:api_url and people:db:type
var config = configure.get('people');
var URL = config.api_url;
var DB_TYPE = config.db.type;
var POST_FEED_TIMEOUT = 1 * 1000;
function post(msg, done) {
    var options = {
        uri: URL,
        timeout: POST_FEED_TIMEOUT,
        method: 'POST',
        json: msg
    };
    request(options, function (error, response, body) {
        // shouldnt be seeing network errors
        if (error)
            throw error;
        if (body.error) {
            error = new Error(body.error.message);
            error.stack = body.error.stack;
        }
        if (response.statusCode !== HTTP_STATUS.OK) {
            if (!error) {
                error = new Error("http statusCode=" + response.statusCode + ", " + HTTP_STATUS.getStatusText(response.statusCode));
            }
            error.http_status = response.statusCode;
        }
        done(error, body);
    });
}
function postAndCallback(msg, done) {
    post(msg, function (error, response) {
        if (!error) {
            var data = response.data;
        }
        else {
        }
        done(error, data);
    });
}
var ApiAsDatabase = (function () {
    function ApiAsDatabase(db_name, type) {
        this.promisified_create = promisify(this.create);
        this.promisified_read = promisify(this.read);
        this.promisified_replace = promisify(this.replace);
        this.promisified_update = promisify(this.update);
        this.promisified_del = promisify(this.del);
        this.promisified_find = promisify(this.find);
    }
    // TODO: connect(done?: ErrorOnlyCallback): Promise<void> | void {
    ApiAsDatabase.prototype.connect = function (done) {
        if (done) {
            done();
        }
        else {
            return Promise.resolve();
        }
    };
    // TODO: disconnect(done?: ErrorOnlyCallback): Promise<void> | void {
    ApiAsDatabase.prototype.disconnect = function (done) {
        if (done) {
            done();
        }
        else {
            return Promise.resolve();
        }
    };
    // TODO: create(obj: Person, done?: ObjectCallback<Person>): Promise<Person> | void {
    ApiAsDatabase.prototype.create = function (obj, done) {
        if (done) {
            var msg = {
                action: 'create',
                obj: obj
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_create(obj);
        }
    };
    // TODO: read(_id_or_ids: DocumentID | DocumentID[], done?: ObjectOrArrayCallback<Person>): Promise<Person | Person[]> | void {
    ApiAsDatabase.prototype.read = function (_id_or_ids, done) {
        if (done) {
            if (Array.isArray(_id_or_ids))
                throw new Error('arrays not supported yet');
            var _id = _id_or_ids;
            var msg = {
                action: 'read',
                query: { ids: [_id] }
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_read(_id_or_ids);
        }
    };
    // TODO: replace(obj: Person, done?: ObjectCallback<Person>): Promise<Person> | void {
    ApiAsDatabase.prototype.replace = function (obj, done) {
        if (done) {
            var msg = {
                action: 'replace',
                obj: obj
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_replace(obj);
        }
    };
    // TODO: update(conditions : Conditions, updates: UpdateFieldCommand[], done?: ObjectCallback<Person>): any {
    ApiAsDatabase.prototype.update = function (conditions, updates, done) {
        //if (!conditions || !conditions['_id']) throw new Error('update requires conditions._id')
        if (done) {
            var msg = {
                action: 'update',
                query: { conditions: conditions },
                updates: updates
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_update(conditions, updates);
        }
    };
    // TODO: del(_id: DocumentID, done?: ErrorOnlyCallback): Promise<void> | void {
    ApiAsDatabase.prototype.del = function (_id, done) {
        if (done) {
            var msg = {
                action: 'delete',
                query: { ids: [_id] }
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_del(_id);
        }
    };
    // TODO: find(conditions : Conditions, fields?: Fields, sort?: Sort, cursor?: Cursor, done?: ArrayCallback<Person>): Promise<Person[]> | void {
    ApiAsDatabase.prototype.find = function (conditions, fields, sort, cursor, done) {
        if (done) {
            var msg = {
                action: 'find',
                query: { conditions: conditions, fields: fields, sort: sort, cursor: cursor }
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_find(conditions, fields, sort, cursor);
        }
    };
    return ApiAsDatabase;
}());
exports.ApiAsDatabase = ApiAsDatabase;
var db = new ApiAsDatabase('people-service-db', 'Person');
// NOTE: these tests are identical to the ones in people-db.tests.ts
// except for checking http status codes
describe("generic-data-server using " + DB_TYPE, function () {
    var mongo_daemon;
    var db_server;
    function getDB() { return db; }
    before(function (done) {
        var mongo_daemon_options = {
            use_tmp_dir: true,
            disable_logging: true,
            port: config.db.port
        };
        mongo_daemon = new mongod_runner_1.MongoDaemonRunner(mongo_daemon_options);
        mongo_daemon.start(function (error) {
            if (!error) {
                db_server = new generic_data_server_1.SingleTypeDatabaseServer({
                    config: config,
                    log: log,
                    mongoose_data_definition: person_mongoose_schema_1.PERSON_SCHEMA_DEF });
                var app = express();
                db_server.configureExpress(app);
                db_server.connect(function (error) {
                    if (!error) {
                        var api_port = config.api_port;
                        log.info({ config: config }, "listening on port=" + api_port);
                        app.listen(api_port);
                    }
                    done(error);
                });
            }
            else {
                console.error("Failed to start mongo daemon: error=" + error);
                done(error);
            }
        });
    });
    after(function (done) {
        db_server.disconnect(function (error) {
            if (!error) {
                mongo_daemon.stop(done);
            }
            else {
                done(error);
            }
        });
    });
    describe('create()', function () {
        document_database_tests_1.test_create(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('read()', function () {
        document_database_tests_1.test_read(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('replace()', function () {
        document_database_tests_1.test_replace(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('update()', function () {
        var config = {
            test: {
                populated_string: 'account_email',
                unpopulated_string: 'time_zone',
                string_array: { name: 'profile_pic_urls' },
                obj_array: {
                    name: 'contact_methods',
                    key_field: 'address',
                    populated_field: { name: 'method', type: 'string' },
                    unpopulated_field: { name: 'display_name', type: 'string' },
                    createElement: example_data_type_1.newContactMethod
                }
            },
            unsupported: (DB_TYPE !== 'InMemoryDB') ? undefined : {
                object: {
                    set: false,
                    unset: true
                },
                array: {
                    set: true,
                    unset: true,
                    insert: true,
                    remove: true
                }
            }
        };
        document_database_tests_1.test_update(getDB, example_data_type_1.newPerson, config);
    });
    describe('del()', function () {
        document_database_tests_1.test_del(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('find()', function () {
        document_database_tests_1.test_find(getDB, example_data_type_1.newPerson, 'account_email');
    });
});
