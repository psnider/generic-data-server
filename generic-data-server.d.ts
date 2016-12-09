import express = require('express-serve-static-core')
import pino = require('pino')
import {Cursor, DocumentBase, DocumentID, Conditions, Fields, ErrorOnlyCallback, Sort, UpdateFieldCommand} from '@sabbatical/document-database'


// these seem to be missing from mongoose 
// TODO: add to mongoose.d.ts
type MongooseObjectId = any
type MongooseDataFunction = (...any) => any
type MongooseDataDefinitionFunction = MongooseObjectId | MongooseDataFunction
type MongooseDataDefinitionType = MongooseDataDefinitionFunction | MongooseDataDefinitionFunction[] | MongooseDataDefinition | MongooseDataDefinition[]
type MongooseDataDefinition = {[fieldname:string]: MongooseDataDefinitionType}


type DocumentType = {}

// TODO: refactor into generic-data-server
export interface RequestQuery {
    // id or ids: use these for any queries that do not involve other fields.
    // Required for read, delete
    // use id for a single ID, the result will be a single object
    _id?:           DocumentID
    // use ids for a set of IDs, the result will be an array of objects
    _ids?:          DocumentID[]
    // Used only by update, find
    conditions?:    Conditions
    fields?:        Fields
    sort?:          Sort
    cursor?:        Cursor
}


// TODO: refactor into generic-data-server
type Action = 'create' | 'read' | 'update' | 'replace' | 'delete' | 'find'


// TODO: refactor into generic-data-server
export interface Request {
    action:         Action
    // obj: used only by create and replace
    obj?:           DocumentType
    // query: used for all but create and replace
    query?:         RequestQuery
    // updates: used by update only
    updates?:       UpdateFieldCommand[]
}


export interface Response {
    error?: any
    total_count?: number
    data?: DocumentType | DocumentType[]
}


export interface SingleTypeDatabaseServerOptions {
    config: MicroServiceConfig
    log: any // TODO: must be pino(), but can't find type
    mongoose_data_definition?: MongooseDataDefinition
}


export class SingleTypeDatabaseServer {
    constructor(options: SingleTypeDatabaseServerOptions)
    configureExpress(app: express.Express): void
    connect(done: ErrorOnlyCallback): void
    connect() : Promise<void>
    disconnect(done: (error?: Error) => void)
    disconnect() : Promise<void>
}


// These settings will be in config/common.json
export interface CommonSettings {
    // the name of the service, e.g. people
    service_name: string
    // the name of the database table used with this service, e.g. people
    database_table_name: string
    // the name of the type of the data for this service, e.g. Person
    typename: string
    // See https://www.npmjs.com/package/body-parser#limit, e.g. '5mb'
    body_parser_limit: string
    // The prefix of the path portion of the URL for the service, e.g. 'api/people'
    api_url_path_prefix: string
}


// These settings will be in config/${NODE_ENV}.json
export interface NodeEnvironmentSettings {
    // The hostname for this service, e.g. localhost
    hostname?: string
    // The port for the api service, e.g. 3000
    api_port: number
    // The name of the user that runs the deployed service, e.g. 'people'
    app_user?: string
    // The URL for the service API, e.g. 'http://localhost:3000/api/people'
    api_url: string
    // Configuration for the database used by the service
    db: DatabaseConfig
}


export interface DatabaseConfig {
    // The database to use for this service instance
    type: 'MongoDBAdaptor' | 'InMemoryDB'
    // The port for the database.
    // e.g. 27017 for a persistent mongodb
    //      27106 for a temporary mongodb for a test instance
    port: number
    // e.g. localhost:27017/test
    url: string
}


// The configuration accepted by a generic-data-server micro-service
export type MicroServiceConfig = CommonSettings & NodeEnvironmentSettings



