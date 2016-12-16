"use strict";
const HTTP_STATUS = require('http-status-codes');
const request = require('request');
const CHAI = require('chai');
const expect = CHAI.expect;
const express = require('express');
const pino = require('pino');
const promisify = require("promisify-node");
process.env.NODE_ENV = 'development-test';
const configure = require('@sabbatical/configure-local');
const example_data_type_1 = require('./example-data-type');
const tests_1 = require('@sabbatical/document-database/tests');
const generic_data_server_1 = require('@sabbatical/generic-data-server');
const person_mongoose_schema_1 = require('./person.mongoose-schema');
const mongod_runner_1 = require('@sabbatical/mongod-runner');
const mongoose_connector_1 = require('@sabbatical/mongoose-connector');
var enable_logging = (process.env.DISABLE_LOGGING == null) || ((process.env.DISABLE_LOGGING.toLowerCase() !== 'true') && (process.env.DISABLE_LOGGING !== '1'));
var log = pino({ name: 'generic-data-server.tests', enabled: enable_logging });
// test programs should set the configuration of people:api_url and people:db:type
const config = configure.get('people');
const URL = config.api_url;
const DB_TYPE = config.db.type;
const POST_FEED_TIMEOUT = 1 * 1000;
function post(msg, done) {
    var options = {
        uri: URL,
        timeout: POST_FEED_TIMEOUT,
        method: 'POST',
        json: msg
    };
    request(options, (error, response, body) => {
        // shouldnt be seeing network errors
        if (error)
            throw error;
        if (body.error) {
            error = new Error(body.error.message);
            error.stack = body.error.stack;
        }
        if (response.statusCode !== HTTP_STATUS.OK) {
            if (!error) {
                error = new Error(`http statusCode=${response.statusCode}, ${HTTP_STATUS.getStatusText(response.statusCode)}`);
            }
            error.http_status = response.statusCode;
        }
        done(error, body);
    });
}
function postAndCallback(msg, done) {
    post(msg, (error, response) => {
        if (!error) {
            var data = response.data;
        }
        else {
        }
        done(error, data);
    });
}
class ApiAsDatabase {
    constructor(db_name, type) {
        this.promisified_create = promisify(this.create);
        this.promisified_read = promisify(this.read);
        this.promisified_replace = promisify(this.replace);
        this.promisified_update = promisify(this.update);
        this.promisified_del = promisify(this.del);
        this.promisified_find = promisify(this.find);
    }
    connect(done) {
        if (done) {
            done();
        }
        else {
            return Promise.resolve();
        }
    }
    disconnect(done) {
        if (done) {
            done();
        }
        else {
            return Promise.resolve();
        }
    }
    create(obj, done) {
        if (done) {
            let msg = {
                action: 'create',
                obj
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_create(obj);
        }
    }
    read(_id_or_ids, done) {
        if (done) {
            let msg = {
                action: 'read',
                query: {}
            };
            if (Array.isArray(_id_or_ids)) {
                msg.query._ids = _id_or_ids;
            }
            else {
                msg.query._id = _id_or_ids;
            }
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_read(_id_or_ids);
        }
    }
    replace(obj, done) {
        if (done) {
            let msg = {
                action: 'replace',
                obj
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_replace(obj);
        }
    }
    update(conditions, updates, done) {
        //if (!conditions || !conditions['_id']) throw new Error('update requires conditions._id')
        if (done) {
            let msg = {
                action: 'update',
                query: { conditions },
                updates
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_update(conditions, updates);
        }
    }
    del(_id, done) {
        if (done) {
            let msg = {
                action: 'delete',
                query: { _id }
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_del(_id);
        }
    }
    find(conditions, fields, sort, cursor, done) {
        if (done) {
            let msg = {
                action: 'find',
                query: { conditions, fields, sort, cursor }
            };
            postAndCallback(msg, done);
        }
        else {
            return this.promisified_find(conditions, fields, sort, cursor);
        }
    }
}
exports.ApiAsDatabase = ApiAsDatabase;
var db = new ApiAsDatabase('people-service-db', 'Person');
// NOTE: these tests are identical to the ones in people-db.tests.ts
// except for checking http status codes
describe(`generic-data-server using ${DB_TYPE}`, function () {
    var mongo_daemon;
    var db_server;
    function getDB() { return db; }
    before((done) => {
        var mongo_daemon_options = {
            use_tmp_dir: true,
            disable_logging: true,
            port: config.db.port
        };
        mongo_daemon = new mongod_runner_1.MongoDaemonRunner(mongo_daemon_options);
        mongo_daemon.start((error) => {
            if (!error) {
                let shared_connections = new mongoose_connector_1.SharedConnections(log);
                db_server = new generic_data_server_1.SingleTypeDatabaseServer({
                    config,
                    log,
                    mongoose_config: {
                        mongoose_data_definition: person_mongoose_schema_1.PERSON_SCHEMA_DEF,
                        shared_connections
                    }
                });
                var app = express();
                db_server.configureExpress(app);
                db_server.connect((error) => {
                    if (!error) {
                        const api_port = config.api_port;
                        log.info({ config }, `listening on port=${api_port}`);
                        app.listen(api_port);
                    }
                    done(error);
                });
            }
            else {
                console.error(`Failed to start mongo daemon: error=${error}`);
                done(error);
            }
        });
    });
    after((done) => {
        db_server.disconnect((error) => {
            if (!error) {
                mongo_daemon.stop(done);
            }
            else {
                done(error);
            }
        });
    });
    describe('create()', function () {
        tests_1.test_create(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('read()', function () {
        tests_1.test_read(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('replace()', function () {
        tests_1.test_replace(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('update()', function () {
        let config = {
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
        tests_1.test_update(getDB, example_data_type_1.newPerson, config);
    });
    describe('del()', function () {
        tests_1.test_del(getDB, example_data_type_1.newPerson, ['account_email', 'locale']);
    });
    describe('find()', function () {
        tests_1.test_find(getDB, example_data_type_1.newPerson, 'account_email');
    });
});
//# sourceMappingURL=generic-data-server.tests.js.map