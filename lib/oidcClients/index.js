"use strict";

const async        = require('async'),
      {generators} = require('openid-client'),
      {Issuer}     = require('openid-client');

const promise = new Promise((resolve, reject) => initialize().then(resolve).catch(reject));

module.exports = async function init() {
    return promise;
};

async function initialize() {
    console.log(`initializing OpenID clients`);

    return async.parallel({
        google: createGoogleClient,
        yahoo : createYahooClient,
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