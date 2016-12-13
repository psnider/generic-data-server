import mongoose = require("mongoose");


var PERSON_NAME_SCHEMA_DEF = {
    family: String,
    given: String,
    additional: String
};


// no primary ID, this entire document is the ID
var CONTACT_METHOD_SCHEMA_DEF = {
    method: String,
    address: String,
    display_name: String
};


var LOCATION_SCHEMA_DEF = {
    lat: Number,
    lng: Number,
    when: Date
};


export var PERSON_SCHEMA_DEF = {
    _test_only: Boolean,
    account_email: String,
    account_status: String,
    name: PERSON_NAME_SCHEMA_DEF,
    locale: String,
    time_zone: String,
    role: String,
    contact_methods: [CONTACT_METHOD_SCHEMA_DEF],
    last_known_loc: LOCATION_SCHEMA_DEF,
    profile_pic_urls: [String]   // URL
};



// TODO: [add indexes to mongodbs](https://github.com/psnider/pets/issues/23)
//PERSON_SCHEMA.index({ account_email: 1}, { unique: true });
//PERSON_SCHEMA.set('autoIndex', false);
