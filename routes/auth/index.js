"use strict";

const asyncHandler = require('express-async-handler'),
      bodyParser   = require('body-parser'),
      {generators} = require('openid-client'),
      router       = require('express').Router();

const oidcClients = require('../../lib/oidcClients');

module.exports = router;

let openIdClients;

oidcClients().then((clients) => openIdClients = clients);

router.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }

    if (req.cookies['idp']) {
        switch (req.cookies['idp']) {
            case 'google':
                return res.redirect('/auth/google');
                break;
            case 'yahoo':
                return res.redirect('/auth/yahoo');
                break;
        }
    }

    res.render('login', {
        title        : 'login page',
        googleAuthUrl: '/auth/google',
        yahooAuthUrl : '/auth/yahoo'
    })
});

router.use((req, res, next) => oidcClients().then(() => next())); // always wait until clients initialized

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

    try {
        const tokenSet = await googleOpenIdClient.grant({
            code,
            grant_type  : 'authorization_code',
            redirect_uri: `${process.env.AUTH_CB_URL}/cb-google`
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
    } catch (err) {
        console.error(`${err}`);
        console.error(`after receiving auth code: ${code}`);
        console.error(`and having session content: ${JSON.stringify(req.session)}`);
        next(err);
    }
}));

router.get('/yahoo', redirectPatch, (req, res) => {
    const authUrl = openIdClients.yahoo.authorizationUrl({
        scope: 'openid',
    });

    console.log(`redirecting to ${authUrl}`);

    res.redirect(authUrl)
});

router.get('/cb-yahoo', bodyParser.urlencoded({extended: false}), redirectPatch, asyncHandler(async (req, res, next) => {
    const yahooOpenIdClient = openIdClients.yahoo;
    const code = req.query.code;

    try {
        const tokenSet = await yahooOpenIdClient.grant({
            code,
            grant_type  : 'authorization_code',
            redirect_uri: `${process.env.AUTH_CB_URL}/cb-yahoo`
        });

        const claims = tokenSet.claims();

        req.session.user = {
            idp: 'yahoo',
            ...claims
        };

        req.session.loggedIn = true;
        delete req.session.nonce;

        res.cookie('idp', 'yahoo', {maxAge: 3600000 * 24 * 365 * 10});

        res.redirect('/');
    } catch (err) {
        console.error(`${err}`);
        console.error(`after receiving auth code: ${code}`);
        console.error(`and having session content: ${JSON.stringify(req.session)}`);
        next(err);
    }
}));

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('session');
        res.clearCookie('idp');
        res.redirect('/');
    });
});

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