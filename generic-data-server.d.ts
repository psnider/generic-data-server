import express = require('express-serve-static-core')
import pino = require('pino')
import {DocumentBase, ErrorOnlyCallback} from 'document-database-if'


// these seem to be missing from mongoose 
// TODO: add to mongoose.d.ts
type MongooseObjectId = any
type MongooseDataFunction = (...any) => any
type MongooseDataDefinitionFunction = MongooseObjectId | MongooseDataFunction
type MongooseDataDefinitionType = MongooseDataDefinitionFunction | MongooseDataDefinitionFunction[] | MongooseDataDefinition | MongooseDataDefinition[]
type MongooseDataDefinition = {[fieldname:string]: MongooseDataDefinitionType}




export interface SingleTypeDatabaseServerOptions {
    config: MicroServiceConfig
    log: any // TODO: must be pino(), but can't find type
    mongoose_data_definition?: MongooseDataDefinition
}


export class SingleTypeDatabaseServer<DataType extends DocumentBase> {
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
    hostname: string
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



