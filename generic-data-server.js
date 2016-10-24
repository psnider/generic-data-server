"use strict";
var body_parser = require('body-parser');
var express = require('express');
var HTTP_STATUS = require('http-status-codes');
var mongoose = require('mongoose');
var pino = require('pino');
var configure = require('configure-local');
var in_memory_db_1 = require('in-memory-db');
var mongodb_adaptor_1 = require('mongodb-adaptor');
var ApiServer = (function () {
    // mongoose_schema is not required for an InMemoryDB database
    function ApiServer(configuration_key, mongoose_data_definition) {
        // IMPLEMENTATION NOTE: typescript doesn't allow the use of the keyword delete as a function name
        this.VALID_ACTIONS = {
            create: this.create,
            read: this.read,
            replace: this.replace,
            update: this.update,
            delete: this.del,
            find: this.find
        };
        var fname = 'constructor';
        this.configuration_key = configuration_key;
        this.mongoose = { data_definition: mongoose_data_definition, schema: undefined, model: undefined };
        this.config = configure.get(this.configuration_key);
        this.log = pino({ name: this.config.service_name, enabled: !process.env.DISABLE_LOGGING });
        this.app = express();
        this.configureExpress();
        this.log.info({ fname: fname, config: this.config });
        this.selectDatabase();
    }
    ApiServer.prototype.configureExpress = function () {
        var _this = this;
        var limit = this.config.body_parser_limit;
        var jsonParser = body_parser.json({ limit: limit });
        this.app.use(body_parser.json({ limit: limit }));
        this.app.post(this.config.api_url_path_prefix, jsonParser, function (req, res) { return _this.handlePeople(req, res); });
    };
    ApiServer.prototype.selectDatabase = function () {
        // TODO: change to take db from fixed path, set by a link
        // test programs should set the configuration of people:db:*
        switch (this.config.db.type) {
            case 'InMemoryDB':
                this.db = new in_memory_db_1.InMemoryDB('people', 'Person');
                break;
            case 'MongoDBAdaptor':
                this.initMongooseModel();
                break;
            default:
                throw new Error(this.configuration_key + ":db:type must be configured to be either: InMemoryDB or MongoDBAdaptor");
        }
    };
    ApiServer.prototype.initMongooseModel = function () {
        this.mongoose.schema = new mongoose.Schema(this.mongoose.data_definition);
        this.mongoose.model = mongoose.model(this.config.database_table_name, this.mongoose.schema);
        // TODO: support adding index specifications
        // this.mongoose.schema.index({ account_email: 1}, { unique: true });
        // this.mongoose.schema.set('autoIndex', false);
        // this.mongoose.model.ensureIndexes(function (error) {
        //     if (error) {
        //         throw error;
        //     }
        // });
        this.db = new mongodb_adaptor_1.MongoDBAdaptor(this.config.db.url, this.mongoose.model);
    };
    ApiServer.prototype.start = function (done) {
        var _this = this;
        var fname = 'start';
        this.log.info({ fname: fname, db_state: 'connecting' });
        this.db.connect(function (error) {
            if (!error) {
                _this.log.info({ fname: fname, db_state: 'connected' });
                var api_port = _this.config.api_port;
                _this.server = _this.app.listen(api_port);
                _this.log.info({ fname: fname, service_state: 'listening', port: api_port });
                done();
            }
            else {
                done(error);
            }
        });
    };
    ApiServer.prototype.stop = function (done) {
        var _this = this;
        var fname = 'stop';
        this.log.info({ fname: fname, db_state: 'disconnecting' });
        this.db.disconnect(function (error) {
            if (!error) {
                _this.log.info({ fname: fname, db_state: 'disconnected' });
                _this.server.close();
                _this.log.info({ fname: fname, service_state: 'closed' });
                done();
            }
            else {
                done(error);
            }
        });
    };
    ApiServer.prototype.create = function (msg, done) {
        this.db.create(msg.obj, done);
    };
    ApiServer.prototype.read = function (msg, done) {
        var _id = msg.query && msg.query.ids && msg.query.ids[0];
        this.db.read(_id, done);
    };
    ApiServer.prototype.replace = function (msg, done) {
        this.db.replace(msg.obj, done);
    };
    ApiServer.prototype.update = function (msg, done) {
        this.db.update(msg.query && msg.query.conditions, msg.updates, done);
    };
    ApiServer.prototype.del = function (msg, done) {
        var _id = msg.query && (msg.query.ids && msg.query.ids[0]);
        this.db.del(_id, done);
    };
    ApiServer.prototype.find = function (msg, done) {
        this.db.find(msg.query && msg.query.conditions, msg.query && msg.query.fields, msg.query && msg.query.sort, msg.query && msg.query.cursor, done);
    };
    ApiServer.prototype.handlePeople = function (req, res) {
        var _this = this;
        var fname = 'handlePeople';
        var msg = req.body;
        if (msg) {
            // restrict the space of user input actions to those that are public
            var action = this.VALID_ACTIONS[msg.action];
            if (action) {
                action.call(this, msg, function (error, db_response) {
                    var response;
                    if (!error) {
                        // TODO: must set response.total_count for find()
                        response = {
                            data: db_response
                        };
                        _this.log.info({ fname: fname, action: msg.action, http_status: 'ok' });
                        res.send(response);
                    }
                    else {
                        var http_status = void 0;
                        // TODO: consider generating a GUID to present to the user for reporting
                        if (error.http_status) {
                            http_status = error.http_status;
                            _this.log.warn({ fname: fname, action: msg.action, http_status: http_status, error: { message: error.message, stack: error.stack } }, msg.action + " failed");
                        }
                        else {
                            http_status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
                            _this.log.error({ fname: fname, action: msg.action, http_status: http_status, error: { message: error.message, stack: error.stack } }, msg.action + " error didnt include error.http_status");
                        }
                        // TODO: figure out how to not send errors in production, but also pass document-database-tests
                        //if (process.env.NODE_ENV === 'development') {
                        res.status(http_status);
                        response = { error: { message: error.message, stack: error.stack } };
                        res.send(response);
                    }
                });
            }
            else {
                // TODO: consider generating a GUID to present to the user for reporting
                this.log.warn({ fname: fname, action: msg.action, msg: 'msg.action is invalid' });
                res.sendStatus(HTTP_STATUS.BAD_REQUEST);
                this.log.warn({ fname: fname, action: msg.action });
            }
        }
        else {
            res.sendStatus(400);
        }
    };
    // TODO: figure out clean way to get these
    ApiServer.VERSION = {
        semver: undefined,
        sha: undefined
    };
    return ApiServer;
}());
exports.ApiServer = ApiServer;
