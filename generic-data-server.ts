import body_parser = require('body-parser');
import {Express} from 'express-serve-static-core'
import HTTP_STATUS = require('http-status-codes');
import mongoose = require('mongoose')
mongoose.Promise = global.Promise;
import pino = require('pino')

import configure = require('configure-local')
import {DocumentDatabase, DocumentID, DocumentBase, Request, Response} from 'document-database-if'
import {SingleTypeDatabaseServerOptions, MicroServiceConfig} from 'generic-data-server'
import {InMemoryDB} from 'in-memory-db'
import {MongoDBAdaptor} from 'mongodb-adaptor'



export class SingleTypeDatabaseServer<DataType extends DocumentBase> {

    // TODO: figure out clean way to get these
    static VERSION = {
        semver: undefined,
        sha: undefined
    }

    // IMPLEMENTATION NOTE: typescript doesn't allow the use of the keyword delete as a function name
    private VALID_ACTIONS: {[action: string]: (msg: Request<DataType>, done: (error?: Error) => void) => void}
    private config: MicroServiceConfig
    private log
    private db: DocumentDatabase<DataType>
    private mongoose: {
        data_definition: Object
        schema: mongoose.Schema
        model: mongoose.Model<mongoose.Document>
    }


    // mongoose_schema is not required for an InMemoryDB database
    constructor(options: SingleTypeDatabaseServerOptions) {
        let fname = 'constructor'
        this.VALID_ACTIONS = {
            create: this.create, 
            read: this.read,
            replace: this.replace,
            update: this.update,
            delete: this.del,
            find: this.find
        }
        this.config = options.config
        this.log = options.log
        this.log.info({fname, config: this.config})
        this.selectDatabase(options.mongoose_data_definition)
    }


    configureExpress(app: Express) {
        const limit = this.config.body_parser_limit
        let jsonParser = body_parser.json({limit})
        //app.use(body_parser.json({limit}))
        this.log.info({fname: 'SingleTypeDatabaseServer.configureExpress', post: {api_url_path_prefix: this.config.api_url_path_prefix}})
        app.post(this.config.api_url_path_prefix, jsonParser, (req, res) => {
            this.handleDataRequest(req, res)
        })    
    }




    private selectDatabase(mongoose_data_definition?: Object) {
        // TODO: change to take db from fixed path, set by a link, or some other means
        switch (this.config.db.type) {
            case 'InMemoryDB':
                this.db = new InMemoryDB(this.config.database_table_name, this.config.typename)
                break
            case 'MongoDBAdaptor':
                this.initMongooseModel(mongoose_data_definition)
                break
            default:
                throw new Error(`config.db.type must be configured to be either: InMemoryDB or MongoDBAdaptor`)
        }
    }


    private initMongooseModel(mongoose_data_definition?: Object) {
        this.mongoose = {
            data_definition: mongoose_data_definition,
            schema: undefined,
            model: undefined
        }
        this.mongoose.schema = new mongoose.Schema(this.mongoose.data_definition)
        this.mongoose.model = mongoose.model(this.config.database_table_name, this.mongoose.schema)
        // TODO: support adding index specifications
        // this.mongoose.schema.index({ account_email: 1}, { unique: true });
        // this.mongoose.schema.set('autoIndex', false);
        // this.mongoose.model.ensureIndexes(function (error) {
        //     if (error) {
        //         throw error;
        //     }
        // });
        this.db = new MongoDBAdaptor<DataType>(this.config.db.url, this.mongoose.model)
    }


    connect(done: (error?: Error) => void) {
        let fname = 'connect'
        this.log.info({fname, db_state: 'connecting'})
        this.db.connect((error) => {
            if (!error) {
                this.log.info({fname, db_state: 'connected'})
            }
            done(error)
        })
    }


    disconnect(done: (error?: Error) => void) {
        let fname = 'disconnect'
        this.log.info({fname, db_state: 'disconnecting'})
        this.db.disconnect((error) => {
            if (!error) {
                this.log.info({fname, db_state: 'disconnected'})
            }
            done(error)
        })
    }



    private create(msg: Request<DataType>, done) {
        this.db.create(msg.obj, done)
    }


    private read(msg:Request<DataType>, done) {
        let _id = msg.query && msg.query.ids && msg.query.ids[0]
        this.db.read(_id, done)
    }


    private replace(msg:Request<DataType>, done) {
        this.db.replace(msg.obj, done)
    }


    private update(msg:Request<DataType>, done) {
        this.db.update(msg.query && msg.query.conditions, msg.updates, done)
    }


    private del(msg:Request<DataType>, done) {
        let _id = msg.query && (msg.query.ids && msg.query.ids[0])
        this.db.del(_id, done)
    }


    private find(msg:Request<DataType>, done) {
        this.db.find(msg.query && msg.query.conditions, msg.query && msg.query.fields, msg.query && msg.query.sort, msg.query && msg.query.cursor, done)
    }


    private handleDataRequest(req, res) {
        const fname = 'handleDataRequest'
        const msg:Request<DataType> = req.body
        if (msg) {
            // restrict the space of user input actions to those that are public
            var action = this.VALID_ACTIONS[msg.action];
            if (action) {
                action.call(this, msg, (error, db_response: DataType | DataType[]) => {
                    let response: Response<DataType>
                    if (!error) {
                        // TODO: must set response.total_count for find()
                        response = {
                            data: db_response
                        }
                        this.log.info({fname, action: msg.action, http_status: 'ok'})
                        res.send(response)             
                    } else {
                        let http_status
                        // TODO: consider generating a GUID to present to the user for reporting
                        if (error.http_status) {
                            http_status = error.http_status
                            this.log.warn({fname, action: msg.action, http_status, error: {message: error.message, stack: error.stack}}, `${msg.action} failed`)
                        } else {
                            http_status = HTTP_STATUS.INTERNAL_SERVER_ERROR
                            this.log.error({fname, action: msg.action, http_status, error: {message: error.message, stack: error.stack}}, `${msg.action} error didnt include error.http_status`) 
                        }
                        // TODO: figure out how to not send errors in production, but also pass document-database-tests
                        //if (process.env.NODE_ENV === 'development') {
                            res.status(http_status)
                            response = {error: {message: error.message, stack: error.stack}}
                            res.send(response)
                        // } else {
                        //     res.sendStatus(http_status)                        
                        // }
                    }
                })
            } else {
                // TODO: consider generating a GUID to present to the user for reporting
                this.log.warn({fname, action: msg.action, msg: 'msg.action is invalid'})
                res.sendStatus(HTTP_STATUS.BAD_REQUEST);
                this.log.warn({fname, action: msg.action})
            }
        } else {
            res.sendStatus(400)
        }
    }


}
