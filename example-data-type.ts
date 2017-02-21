
// example data type, from people-service project
type DatabaseObjectID = string;
type URL = string;


export interface Name {
    family?: string;
    given?: string;
    additional?: string;
}


export type ContactMethodType = 'mobile' | 'phone' | 'twitter'
export interface ContactMethod {
    method?: string;
    address?: string;
    display_name?: string
}


export interface Person {
    // NOTE: leading underscore indicates this is special, in this case, not set by user
    _id?:               DatabaseObjectID;
    _obj_ver?:          number;
    _test_only?:        boolean;
    account_email?:     string;
    account_status?:    string;
    name?:              Name;
    locale?:            string;
    time_zone?:         string;
    role?:              string;
    contact_methods?:   ContactMethod[];
    profile_pic_urls?:  URL[];
}




let next_email_id = 1
let next_mobile_number = 1234

// This is identical to newPerson() in people-db.tests.ts
export function newPerson(options?: {_id?: string, name?: Name}) : Person {
    const name = (options && options.name) ? options.name : {given: 'Bob', family: 'Smith'}
    const account_email = `${name.given}.${name.family}.${next_email_id++}@test.co`
    const mobile_number = `555-${("000" + next_mobile_number++).slice(-4)}`
    let person : Person = {
        account_email,
        account_status:    'invitee',
        //role:              'user',
        name,
        locale:            'en_US',
        contact_methods:   [{method: 'mobile', address: mobile_number}],
        profile_pic_urls:  ['shorturl.com/1234']
    }
    if (options && options._id) person._id = options._id
    return person
}


let next_contact_number = 1
export function newContactMethod() : ContactMethod {
    const phone_number = `555-${("001" + next_mobile_number++).slice(-4)}`
    return {
        method: ((next_contact_number++ % 2) == 0) ? 'phone' : 'mobile', 
        address: phone_number
    }
}

