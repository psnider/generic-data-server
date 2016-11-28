"use strict";
const body_parser = require('body-parser');
const HTTP_STATUS = require('http-status-codes');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const in_memory_db_1 = require('@sabbatical/in-memory-db');
const mongodb_adaptor_1 = require('@sabbatical/mongodb-adaptor');
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
        this.selectDatabase(options.mongoose_data_definition);
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
    selectDatabase(mongoose_data_definition) {
        // TODO: change to take db from fixed path, set by a link, or some other means
        switch (this.config.db.type) {
            case 'InMemoryDB':
                this.db = new in_memory_db_1.InMemoryDB(this.config.database_table_name, this.config.typename);
                break;
            case 'MongoDBAdaptor':
                this.initMongooseModel(mongoose_data_definition);
                break;
            default:
                throw new Error(`config.db.type must be configured to be either: InMemoryDB or MongoDBAdaptor`);
        }
    }
    initMongooseModel(mongoose_data_definition) {
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
    }
    connect(done) {
        return this.db.connect(done);
    }
    disconnect(done) {
        return this.db.disconnect(done);
    }
    create(msg, done) {
        return this.db.create(msg.obj, done);
    }
    read(msg, done) {
        let _id = msg.query && msg.query.ids && msg.query.ids[0];
        return this.db.read(_id, done);
    }
    replace(msg, done) {
        return this.db.replace(msg.obj, done);
    }
    update(msg, done) {
        return this.db.update(msg.query && msg.query.conditions, msg.updates, done);
    }
    del(msg, done) {
        let _id = msg.query && (msg.query.ids && msg.query.ids[0]);
        return this.db.del(_id, done);
    }
    find(msg, done) {
        return this.db.find(msg.query && msg.query.conditions, msg.query && msg.query.fields, msg.query && msg.query.sort, msg.query && msg.query.cursor, done);
    }
    handleDataRequest(req, res) {
        const fname = 'handleDataRequest';
        const msg = req.body;
        if (msg) {
            // restrict the space of user input actions to those that are public
            var action = this.VALID_ACTIONS[msg.action];
            if (action) {
                action.call(this, msg, (error, db_response) => {
                    let response;
                    if (!error) {
                        // TODO: must set response.total_count for find()
                        response = {
                            data: db_response
                        };
                        this.log.info({ fname, action: msg.action, http_status: 'ok' });
                        res.send(response);
                    }
                    else {
                        let http_status;
                        // TODO: consider generating a GUID to present to the user for reporting
                        if (error.http_status) {
                            http_status = error.http_status;
                            this.log.warn({ fname, action: msg.action, http_status, error: { message: error.message, stack: error.stack } }, `${msg.action} failed`);
                        }
                        else {
                            http_status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
                            this.log.error({ fname, action: msg.action, http_status, error: { message: error.message, stack: error.stack } }, `${msg.action} error didnt include error.http_status`);
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
// TODO: figure out clean way to get these
SingleTypeDatabaseServer.VERSION = {
    semver: undefined,
    sha: undefined
};
exports.SingleTypeDatabaseServer = SingleTypeDatabaseServer;
//# sourceMappingURL=generic-data-server.js.map