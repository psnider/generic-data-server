"use strict";
const body_parser = require('body-parser');
const HTTP_STATUS = require('http-status-codes');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const in_memory_db_1 = require('@sabbatical/in-memory-db');
const mongoose_adaptor_1 = require('@sabbatical/mongoose-adaptor');
class SingleTypeDatabaseServer {
    // mongoose_schema is not required for an InMemoryDB database
    constructor(options) {
        let fname = 'constructor';
        this.VALID_ACTIONS = {
            create: this.create,
            read: this.read,
            replace: this.replace,
            update: this.update,
            delete: this.del,
            find: this.find
        };
        this.config = options.config;
        this.log = options.log;
        this.log.info({ fname, config: this.config });
        this.selectDatabase(options);
    }
    configureExpress(app) {
        const limit = this.config.body_parser_limit;
        let jsonParser = body_parser.json({ limit });
        //app.use(body_parser.json({limit}))
        this.log.info({ fname: 'SingleTypeDatabaseServer.configureExpress', post: { api_url_path_prefix: this.config.api_url_path_prefix } });
        app.post(this.config.api_url_path_prefix, jsonParser, (req, res) => {
            this.handleDataRequest(req, res);
        });
    }
    selectDatabase(options) {
        switch (this.config.db.type) {
            case 'InMemoryDB':
                this.db = new in_memory_db_1.InMemoryDB();
                break;
            case 'MongooseDBAdaptor':
                this.initMongooseModel(options);
                break;
            default:
                throw new Error(`config.db.type must be configured to be either: InMemoryDB or MongooseDBAdaptor`);
        }
    }
    initMongooseModel(options) {
        this.mongoose = {
            mongoose_config: options.mongoose_config,
            schema: undefined,
            model: undefined
        };
        this.mongoose.schema = new mongoose.Schema(this.mongoose.mongoose_config.mongoose_data_definition);
        this.mongoose.model = mongoose.model(this.config.database_table_name, this.mongoose.schema);
        // TODO: [add index specification mechanism](https://github.com/psnider/generic-data-server/issues/2)
        // this.mongoose.schema.index({ account_email: 1}, { unique: true });
        // this.mongoose.schema.set('autoIndex', false);
        // this.mongoose.model.ensureIndexes(function (error) {
        //     if (error) {
        //         throw error;
        //     }
        // });
        let client_name = `${options.config.service_name}+${options.config.database_table_name}`;
        this.db = new mongoose_adaptor_1.MongooseDBAdaptor(client_name, this.config.db.url, options.mongoose_config.shared_connections, this.mongoose.model);
    }
    connect(done) {
        return this.db.connect(done);
    }
    disconnect(done) {
        return this.db.disconnect(done);
    }
    create(msg, done) {
        this.db.create(msg.obj, done);
    }
    read(msg, done) {
        if (msg.query && (msg.query._id || (msg.query._ids && (msg.query._ids.length > 0)))) {
            if (msg.query._id) {
                this.db.read(msg.query._id, done);
            }
            else {
                this.db.read(msg.query._ids, done);
            }
        }
        else {
            done(new Error('_id_or_ids is invalid'));
        }
    }
    replace(msg, done) {
        this.db.replace(msg.obj, (error, results) => {
            done(error, results);
        });
    }
    update(msg, done) {
        this.db.update(msg.query._id, msg.query._obj_ver, msg.updates, done);
    }
    del(msg, done) {
        if (msg.query && msg.query._id) {
            this.db.del(msg.query._id, done);
        }
        else {
            done(new Error('_id is invalid'));
        }
    }
    find(msg, done) {
        this.db.find(msg.query && msg.query.conditions, msg.query && msg.query.fields, msg.query && msg.query.sort, msg.query && msg.query.cursor, done);
    }
    handleDataRequest(req, res) {
        const fname = 'handleDataRequest';
        const msg = req.body;
        if (msg) {
            // restrict the space of user input actions to those that are public
            var action = this.VALID_ACTIONS[msg.action];
            if (action) {
                action.call(this, msg, (error, db_result) => {
                    let response;
                    if (!error) {
                        // TODO: [ensure that find() returns total_count and respects limit](https://github.com/psnider/generic-data-server/issues/3)
                        response = {
                            data: db_result
                        };
                        this.log.info({ fname, action: msg.action, http_status: 'ok' });
                        res.send(response);
                    }
                    else {
                        let http_status;
                        if ('http_status' in error) {
                            http_status = error.http_status;
                            this.log.warn({ fname, action: msg.action, http_status, error: { message: error.message, stack: error.stack } }, `${msg.action} failed`);
                        }
                        else {
                            http_status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
                            this.log.error({ fname, action: msg.action, http_status, error: { message: error.message, stack: error.stack } }, `${msg.action} error didnt include error.http_status`);
                        }
                        // TODO: [in production, never send Errors to client apps, only AppError.user_message](psnider/pets/issues/24)
                        //if (process.env.NODE_ENV === 'development') {
                        res.status(http_status);
                        response = { error: { message: error.message, stack: error.stack } };
                        res.send(response);
                    }
                });
            }
            else {
                this.log.warn({ fname, action: msg.action, msg: 'msg.action is invalid' });
                res.sendStatus(HTTP_STATUS.BAD_REQUEST);
                this.log.warn({ fname, action: msg.action });
            }
        }
        else {
            res.sendStatus(400);
        }
    }
}
exports.SingleTypeDatabaseServer = SingleTypeDatabaseServer;
//# sourceMappingURL=generic-data-server.js.map