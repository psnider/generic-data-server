"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let next_email_id = 1;
let next_mobile_number = 1234;
// This is identical to newPerson() in people-db.tests.ts
function newPerson(options) {
    const name = (options && options.name) ? options.name : { given: 'Bob', family: 'Smith' };
    const account_email = `${name.given}.${name.family}.${next_email_id++}@test.co`;
    const mobile_number = `555-${("000" + next_mobile_number++).slice(-4)}`;
    let person = {
        account_email,
        account_status: 'invitee',
        //role:              'user',
        name,
        locale: 'en_US',
        contact_methods: [{ method: 'mobile', address: mobile_number }],
        profile_pic_urls: ['shorturl.com/1234']
    };
    if (options && options._id)
        person._id = options._id;
    return person;
}
exports.newPerson = newPerson;
let next_contact_number = 1;
function newContactMethod() {
    const phone_number = `555-${("001" + next_mobile_number++).slice(-4)}`;
    return {
        method: ((next_contact_number++ % 2) == 0) ? 'phone' : 'mobile',
        address: phone_number
    };
}
exports.newContactMethod = newContactMethod;
//# sourceMappingURL=example-data-type.js.map