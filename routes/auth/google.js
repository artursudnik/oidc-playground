"use strict";

const asyncHandler = require('express-async-handler'),
      bodyParser   = require('body-parser'),
      {generators} = require('openid-client'),
      router       = require('express').Router();

const oidcClients = require('../../lib/oidcClients');

module.exports = router;

let openIdClients;

oidcClients().then((clients) => openIdClients = clients);

router.get('/google', redirectPatch, (req, res) => {
    const nonce = generators.nonce();

    req.session.nonce = nonce;

    const authUrl = openIdClients.google.authorizationUrl({
        scope: 'openid email profile',
        nonce,
    });

    console.log(`redirecting to ${authUrl}`);

    res.redirect(authUrl)
});

router.get('/cb-google', redirectPatch, bodyParser.urlencoded({extended: false}), asyncHandler(async (req, res, next) => {
    const googleOpenIdClient = openIdClients.google;
    const code = req.query.code;

    const tokenSet = await googleOpenIdClient.grant({
        code,
        grant_type  : 'authorization_code',
        redirect_uri: `${process.env.AUTH_CB_URL}/cb-google`
    }).catch(err => {
        console.error(`error getting token set: ${err}`);
        return Promise.reject(err);
    });

    const claims = tokenSet.claims();

    req.session.user = {
        idp: 'google',
        ...claims
    };

    req.session.loggedIn = true;
    delete req.session.nonce;

    res.cookie('idp', 'google', {maxAge: 3600000 * 24 * 365 * 10});

    res.redirect('/');
}));

/**
 * Forces session to be saved before redirecting
 * @param req
 * @param res
 * @param next
 */
function redirectPatch(req, res, next) {
    const redirect = res.redirect;
    res.redirect = function (...args) {
        console.log('saving session before redirecting');
        req.session.save(err => {
            if (err) return next(err);
            redirect.call(res, ...args)
        })
    };
    next();
}