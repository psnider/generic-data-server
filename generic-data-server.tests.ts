import HTTP_STATUS = require('http-status-codes');
import request = require('request')
import CHAI = require('chai')
const  expect = CHAI.expect
import express = require('express')
import pino = require('pino')
var promisify = require("promisify-node");

process.env.NODE_ENV = 'development-test'
import configure = require('configure-local')
import {ArrayCallback, Conditions, Cursor, DocumentID, DocumentDatabase, ErrorOnlyCallback, Fields, ObjectCallback, ObjectOrArrayCallback, Request as DBRequest, Response as DBResponse, Sort, UpdateFieldCommand} from 'document-database-if'
import {Person, Name, ContactMethod, newPerson, newContactMethod} from './example-data-type'
import {UpdateConfiguration, test_create, test_read, test_replace, test_del, test_update, test_find} from 'document-database-tests'
import {MicroServiceConfig, SingleTypeDatabaseServer} from 'generic-data-server'
import {PERSON_SCHEMA_DEF} from './person.mongoose-schema'
import {MongoDaemonRunner} from 'mongod-runner'


var enable_logging: boolean = (process.env.DISABLE_LOGGING == null) || ((process.env.DISABLE_LOGGING.toLowerCase() !== 'true') && (process.env.DISABLE_LOGGING !== '1'))
var log = pino({name: 'generic-data-server.tests', enabled: enable_logging})


// test programs should set the configuration of people:api_url and people:db:type
const config = <MicroServiceConfig>configure.get('people')
const URL = config.api_url
const DB_TYPE = config.db.type
const POST_FEED_TIMEOUT = 1 * 1000


function post(msg: DBRequest<Person>, done: (error: Error, results?: DBResponse<Person>) => void) {
    var options: request.OptionsWithUri = {
        uri: URL,
        timeout: POST_FEED_TIMEOUT,
        method: 'POST',
        json: msg
    }
    request(options, (error, response, body) => {
        // shouldnt be seeing network errors
        if (error) throw error
        if (body.error) {
            error = new Error(body.error.message)
            error.stack = body.error.stack
        }
        if (response.statusCode !== HTTP_STATUS.OK) {
            if (!error) {
                error = new Error(`http statusCode=${response.statusCode}, ${HTTP_STATUS.getStatusText(response.statusCode)}`)
            }
            error.http_status = response.statusCode
        }
        done(error, body)
    })
}



function postAndCallback(msg: DBRequest<Person>, done: ObjectOrArrayCallback<Person>) {
    post(msg, (error, response: DBResponse<Person>) => {
        if (!error) {
            var data = response.data
        } else {
            // console.log(`postAndCallback error=${error}`)
            // console.log(`postAndCallback triggering msg=${JSON.stringify(msg)}`)
        }
        done(error, data)
    })
}


export class ApiAsDatabase implements DocumentDatabase<Person> {

    constructor(db_name: string, type: string | {}) {}


    // TODO: connect(done?: ErrorOnlyCallback): Promise<void> | void {
    connect(done?: ErrorOnlyCallback): any {
        if (done) {
            done()
        } else {
            return Promise.resolve()
        }
    }


    // TODO: disconnect(done?: ErrorOnlyCallback): Promise<void> | void {
    disconnect(done?: ErrorOnlyCallback): any {
        if (done) {
            done()
        } else {
            return Promise.resolve()
        }
    }


    // TODO: create(obj: Person, done?: ObjectCallback<Person>): Promise<Person> | void {
    create(obj: Person, done?: ObjectCallback<Person>): any {
        if (done) {
            let msg : DBRequest<Person> = {
                action: 'create',
                obj
            }
            postAndCallback(msg, done)
        } else {
            return this.promisified_create(obj)
        }
    }
    private promisified_create = promisify(this.create)


    // TODO: read(_id_or_ids: DocumentID | DocumentID[], done?: ObjectOrArrayCallback<Person>): Promise<Person | Person[]> | void {
    read(_id_or_ids: DocumentID | DocumentID[], done?: ObjectOrArrayCallback<Person>): any {
        if (done) {
            if (Array.isArray(_id_or_ids)) throw new Error('arrays not supported yet')
            let _id = <DocumentID>_id_or_ids
            let msg : DBRequest<Person> = {
                action: 'read',
                query: {ids: [_id]}
            }
            postAndCallback(msg, done)
        } else {
            return this.promisified_read(_id_or_ids)
        }
    }
    private promisified_read = promisify(this.read)



    // TODO: replace(obj: Person, done?: ObjectCallback<Person>): Promise<Person> | void {
    replace(obj: Person, done?: ObjectCallback<Person>): any {
        if (done) {
            let msg : DBRequest<Person> = {
                action: 'replace',
                obj
            }
            postAndCallback(msg, done)
        } else {
            return this.promisified_replace(obj)
        }
    }
    private promisified_replace = promisify(this.replace)


    // TODO: update(conditions : Conditions, updates: UpdateFieldCommand[], done?: ObjectCallback<Person>): any {
    update(conditions : Conditions, updates: UpdateFieldCommand[], done?: ObjectCallback<Person>): any {
        //if (!conditions || !conditions['_id']) throw new Error('update requires conditions._id')
        if (done) {
            let msg : DBRequest<Person> = {
                action: 'update',
                query: {conditions},
                updates
            }
            postAndCallback(msg, done)
        } else {
            return this.promisified_update(conditions, updates)
        }
    }
    private promisified_update = promisify(this.update)



    // TODO: del(_id: DocumentID, done?: ErrorOnlyCallback): Promise<void> | void {
    del(_id: DocumentID, done?: ErrorOnlyCallback): any {
        if (done) {
            let msg : DBRequest<Person> = {
                action: 'delete',
                query: {ids: [_id]}
            }
            postAndCallback(msg, done)
        } else {
            return this.promisified_del(_id)
        }
    }
    private promisified_del = promisify(this.del)


    // TODO: find(conditions : Conditions, fields?: Fields, sort?: Sort, cursor?: Cursor, done?: ArrayCallback<Person>): Promise<Person[]> | void {
    find(conditions : Conditions, fields?: Fields, sort?: Sort, cursor?: Cursor, done?: ArrayCallback<Person>): any {
        if (done) {
            let msg : DBRequest<Person> = {
                action: 'find',
                query: {conditions, fields, sort, cursor}
            }
            postAndCallback(msg, done)
        } else {
            return this.promisified_find(conditions, fields, sort, cursor)
        }
    }
    private promisified_find = promisify(this.find)
}



var db: ApiAsDatabase = new ApiAsDatabase('people-service-db', 'Person')



// NOTE: these tests are identical to the ones in people-db.tests.ts
// except for checking http status codes
describe(`generic-data-server using ${DB_TYPE}`, function() {

    var mongo_daemon: MongoDaemonRunner
    var db_server: SingleTypeDatabaseServer<Person>

    function getDB() {return db}

    before((done) => {
        var mongo_daemon_options = {
            use_tmp_dir: true, 
            disable_logging: true,
            port: config.db.port
        }
        mongo_daemon = new MongoDaemonRunner(mongo_daemon_options)
        mongo_daemon.start((error) => {
            if (!error) {
                db_server = new SingleTypeDatabaseServer<Person>({
                    config,
                    log,
                    mongoose_data_definition: PERSON_SCHEMA_DEF})
                var app = express()
                db_server.configureExpress(app)
                db_server.connect((error) => {
                    if (!error) {
                        const api_port = config.api_port
                        log.info({config}, `listening on port=${api_port}`)
                        app.listen(api_port)
                    }
                    done(error)
                })
            } else {
                console.error(`Failed to start mongo daemon: error=${error}`)
                done(error)
            }
        })
    })


    after((done) => {
        db_server.disconnect((error) => {
            if (!error) {
                mongo_daemon.stop(done)
            } else {
                done(error)
            }
        })
    })


    describe('create()', function() {
         test_create<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('read()', function() {
         test_read<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('replace()', function() {
         test_replace<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('update()', function() {
        let config: UpdateConfiguration = {
            test: {
                populated_string: 'account_email',
                unpopulated_string: 'time_zone',
                string_array: {name: 'profile_pic_urls'},
                obj_array: {
                    name: 'contact_methods',
                    key_field: 'address',
                    populated_field: {name:'method', type: 'string'},
                    unpopulated_field: {name:'display_name', type: 'string'},
                    createElement: newContactMethod
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
        }         
        test_update<Person>(getDB, newPerson, config)
    })


    describe('del()', function() {
         test_del<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('find()', function() {
         test_find<Person>(getDB, newPerson, 'account_email')
    })
   
})

