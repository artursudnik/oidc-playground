"use strict";

const async    = require('async'),
      {Issuer} = require('openid-client');

const idpsEnabled = process.env.IDPS_ENABLED.split(',').reduce((acc, val) => {
    acc[val] = true;
    return acc;
}, {});

const promise = initialize();

module.exports = async function init() {
    return promise;
};

async function initialize() {
    validate();

    console.log(`initializing OpenID clients`);

    return async.parallel({
        google: idpsEnabled.google ? createGoogleClient : cb => cb(),
        yahoo : idpsEnabled.yahoo ? createYahooClient : cb => cb()
    }).then((clients) => {
        console.log('OIDC clients initialized');
        return clients;
    });
}

async function createGoogleClient() {
    const issuer = await Issuer.discover(`https://accounts.google.com`);
    return new issuer.Client({
        client_id     : process.env.OIDC_GOOGLE_CLIENTID,
        client_secret : process.env.OIDC_GOOGLE_CLIENTSECRET,
        redirect_uris : [`${process.env.AUTH_CB_URL}/cb-google`],
        response_types: ['code']
    });
}

async function createYahooClient() {
    const issuer = await Issuer.discover(`https://api.login.yahoo.com/.well-known/openid-configuration`);
    return new issuer.Client({
        client_id     : process.env.OIDC_YAHOO_CLIENTID,
        client_secret : process.env.OIDC_YAHOO_CLIENTSECRET,
        redirect_uris : [`${process.env.AUTH_CB_URL}/cb-yahoo`],
        response_types: ['code']
    });
}

function validate() {
    [
        'OIDC_GOOGLE_CLIENTID',
        'OIDC_GOOGLE_CLIENTSECRET',
        'OIDC_YAHOO_CLIENTID',
        'OIDC_YAHOO_CLIENTSECRET'
    ].forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`${envVar} is not set`);
        }
    });
}