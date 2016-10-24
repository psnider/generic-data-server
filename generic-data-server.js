"use strict";
var body_parser = require('body-parser');
var HTTP_STATUS = require('http-status-codes');
var mongoose = require('mongoose');
var in_memory_db_1 = require('in-memory-db');
var mongodb_adaptor_1 = require('mongodb-adaptor');
var SingleTypeDatabaseServer = (function () {
    // mongoose_schema is not required for an InMemoryDB database
    function SingleTypeDatabaseServer(options) {
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
        this.config = options.config;
        this.log = options.log;
        this.log.info({ fname: fname, config: this.config });
        this.selectDatabase(options.mongoose_data_definition);
    }
    SingleTypeDatabaseServer.prototype.configureExpress = function (app) {
        var _this = this;
        var limit = this.config.body_parser_limit;
        var jsonParser = body_parser.json({ limit: limit });
        //app.use(body_parser.json({limit}))
        app.post(this.config.api_url_path_prefix, jsonParser, function (req, res) { return _this.handleDataRequest(req, res); });
    };
    SingleTypeDatabaseServer.prototype.selectDatabase = function (mongoose_data_definition) {
        // TODO: change to take db from fixed path, set by a link
        // test programs should set the configuration of people:db:*
        switch (this.config.db.type) {
            case 'InMemoryDB':
                this.db = new in_memory_db_1.InMemoryDB('people', 'Person');
                break;
            case 'MongoDBAdaptor':
                this.initMongooseModel(mongoose_data_definition);
                break;
            default:
                throw new Error("config.db.type must be configured to be either: InMemoryDB or MongoDBAdaptor");
        }
    };
    SingleTypeDatabaseServer.prototype.initMongooseModel = function (mongoose_data_definition) {
        this.mongoose = {
            data_definition: mongoose_data_definition,
            schema: undefined,
            model: undefined
        };
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
    SingleTypeDatabaseServer.prototype.connect = function (done) {
        var _this = this;
        var fname = 'connect';
        this.log.info({ fname: fname, db_state: 'connecting' });
        this.db.connect(function (error) {
            if (!error) {
                _this.log.info({ fname: fname, db_state: 'connected' });
            }
            done(error);
        });
    };
    SingleTypeDatabaseServer.prototype.disconnect = function (done) {
        var _this = this;
        var fname = 'disconnect';
        this.log.info({ fname: fname, db_state: 'disconnecting' });
        this.db.disconnect(function (error) {
            if (!error) {
                _this.log.info({ fname: fname, db_state: 'disconnected' });
            }
            done(error);
        });
    };
    SingleTypeDatabaseServer.prototype.create = function (msg, done) {
        this.db.create(msg.obj, done);
    };
    SingleTypeDatabaseServer.prototype.read = function (msg, done) {
        var _id = msg.query && msg.query.ids && msg.query.ids[0];
        this.db.read(_id, done);
    };
    SingleTypeDatabaseServer.prototype.replace = function (msg, done) {
        this.db.replace(msg.obj, done);
    };
    SingleTypeDatabaseServer.prototype.update = function (msg, done) {
        this.db.update(msg.query && msg.query.conditions, msg.updates, done);
    };
    SingleTypeDatabaseServer.prototype.del = function (msg, done) {
        var _id = msg.query && (msg.query.ids && msg.query.ids[0]);
        this.db.del(_id, done);
    };
    SingleTypeDatabaseServer.prototype.find = function (msg, done) {
        this.db.find(msg.query && msg.query.conditions, msg.query && msg.query.fields, msg.query && msg.query.sort, msg.query && msg.query.cursor, done);
    };
    SingleTypeDatabaseServer.prototype.handleDataRequest = function (req, res) {
        var _this = this;
        var fname = 'handleDataRequest';
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
    SingleTypeDatabaseServer.VERSION = {
        semver: undefined,
        sha: undefined
    };
    return SingleTypeDatabaseServer;
}());
exports.SingleTypeDatabaseServer = SingleTypeDatabaseServer;
