import body_parser = require('body-parser');
import express = require('express')
import {Express} from 'express-serve-static-core'
import HTTP_STATUS = require('http-status-codes');
import mongoose = require('mongoose')
mongoose.Promise = global.Promise;
import pino = require('pino')

import configure = require('@sabbatical/configure-local')
import {DocumentDatabase, DocumentID, DocumentBase, ErrorOnlyCallback, ObjectCallback, ArrayCallback, ObjectOrArrayCallback} from '@sabbatical/document-database'
import {Request as DBRequest, Response as DBResponse, MongooseConfig, MongooseDataDefinition, SingleTypeDatabaseServerOptions, MicroServiceConfig} from './generic-data-server.d'

import {InMemoryDB} from '@sabbatical/in-memory-db'
import {MongooseDBAdaptor} from '@sabbatical/mongoose-adaptor'
import {SharedConnections} from '@sabbatical/mongoose-connector'


type DataType = DocumentBase



export class SingleTypeDatabaseServer {

    // IMPLEMENTATION NOTE: typescript doesn't allow the use of the keyword delete as a function name
    private VALID_ACTIONS: {[action: string]: (msg: DBRequest, done: (error?: Error) => void) => void}
    private config: MicroServiceConfig
    private log: any // TODO: [update pino.d.ts](https://github.com/psnider/pets/issues/10)
    private db: DocumentDatabase
    private mongoose: {
        mongoose_config: MongooseConfig
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
        this.selectDatabase(options)
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


    private selectDatabase(options: SingleTypeDatabaseServerOptions) {
        switch (this.config.db.type) {
            case 'InMemoryDB':
                this.db = new InMemoryDB()
                break
            case 'MongooseDBAdaptor':
                this.initMongooseModel(options)
                break
            default:
                throw new Error(`config.db.type must be configured to be either: InMemoryDB or MongooseDBAdaptor`)
        }
    }


    private initMongooseModel(options: SingleTypeDatabaseServerOptions) {
        this.mongoose = {
            mongoose_config: options.mongoose_config,
            schema: undefined,
            model: undefined
        }
        this.mongoose.schema = new mongoose.Schema(this.mongoose.mongoose_config.mongoose_data_definition)
        this.mongoose.model = mongoose.model(this.config.database_table_name, this.mongoose.schema)
        // TODO: [add index specification mechanism](https://github.com/psnider/generic-data-server/issues/2)
        // this.mongoose.schema.index({ account_email: 1}, { unique: true });
        // this.mongoose.schema.set('autoIndex', false);
        // this.mongoose.model.ensureIndexes(function (error) {
        //     if (error) {
        //         throw error;
        //     }
        // });
        let client_name = `${options.config.service_name}+${options.config.database_table_name}`
        this.db = new MongooseDBAdaptor(client_name, this.config.db.url, options.mongoose_config.shared_connections, this.mongoose.model)
    }


    connect(): Promise<void>
    connect(done: ErrorOnlyCallback): void
    connect(done?: ErrorOnlyCallback): Promise<void> | void {
        return this.db.connect(done)
    }


    disconnect(): Promise<void>
    disconnect(done: ErrorOnlyCallback): void
    disconnect(done?: ErrorOnlyCallback): Promise<void> | void {
        return this.db.disconnect(done)
    }


    private create(msg: DBRequest, done: ObjectOrArrayCallback): void {
        this.db.create(msg.obj, done)
    }


    private read(msg: DBRequest, done: ObjectOrArrayCallback): void {
        if (msg.query && (msg.query._id || (msg.query._ids && (msg.query._ids.length > 0)))) {
            if (msg.query._id) {
                this.db.read(msg.query._id, done)
            } else {
                this.db.read(msg.query._ids, done)
            }
        } else {
            done(new Error('_id_or_ids is invalid'))
        }
    }


    private replace(msg: DBRequest, done: ObjectOrArrayCallback): void {
        this.db.replace(msg.obj, (error, results) => {
            done(error, results)
        })
    }


    private update(msg: DBRequest, done: ObjectOrArrayCallback): void {
        this.db.update(msg.query._id, msg.query._obj_ver, msg.updates, done)
    }


    private del(msg: DBRequest, done: ObjectOrArrayCallback): void {
        if (msg.query && msg.query._id) {
            this.db.del(msg.query._id, done)
        } else {
            done(new Error('_id is invalid'))
        }
    }


    private find(msg: DBRequest, done: ObjectOrArrayCallback): void {
        this.db.find(msg.query && msg.query.conditions, msg.query && msg.query.fields, msg.query && msg.query.sort, msg.query && msg.query.cursor, done)
    }


    private handleDataRequest(req: express.Request, res: express.Response): void {
        const fname = 'handleDataRequest'
        const msg:DBRequest = req.body
        if (msg) {
            // restrict the space of user input actions to those that are public
            var action = this.VALID_ACTIONS[msg.action];
            if (action) {
                action.call(this, msg, (error: Error, db_result: DataType | DataType[]) => {
                    let response: DBResponse
                    if (!error) {
                        // TODO: [ensure that find() returns total_count and respects limit](https://github.com/psnider/generic-data-server/issues/3)
                        response = {
                            data: db_result
                        }
                        this.log.info({fname, action: msg.action, http_status: 'ok'})
                        res.send(response)             
                    } else {
                        let http_status: number
                        if ('http_status' in error) {
                            http_status = (<any>error).http_status
                            this.log.warn({fname, action: msg.action, http_status, error: {message: error.message, stack: error.stack}}, `${msg.action} failed`)
                        } else {
                            http_status = HTTP_STATUS.INTERNAL_SERVER_ERROR
                            this.log.error({fname, action: msg.action, http_status, error: {message: error.message, stack: error.stack}}, `${msg.action} error didnt include error.http_status`) 
                        }
                        // TODO: [in production, never send Errors to client apps, only AppError.user_message](psnider/pets/issues/24)
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
                this.log.warn({fname, action: msg.action, msg: 'msg.action is invalid'})
                res.sendStatus(HTTP_STATUS.BAD_REQUEST);
                this.log.warn({fname, action: msg.action})
            }
        } else {
            res.sendStatus(400)
        }
    }


}
