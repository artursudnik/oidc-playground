"use strict";

const axios        = require('axios'),
      asyncHandler = require('express-async-handler'),
      bodyParser   = require('body-parser'),
      {generators} = require('openid-client'),
      queryString  = require('querystring'),
      router       = require('express').Router();

const idpsEnabled = process.env.IDPS_ENABLED.split(',').reduce((acc, val) => {
    acc[val] = true;
    return acc;
}, {});

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
            case 'facebook':
                return res.redirect('/auth/facebook');
                break;
        }
    }

    res.render('login', {
        title   : 'login page',
        authUris: Object.keys(idpsEnabled).map(idp => ({name: idp, uri: `/auth/${idp}`}))
    })
});

router.use((req, res, next) => oidcClients().then(() => next())); // always wait until clients initialized

if (idpsEnabled.google) {
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
}

if (idpsEnabled.yahoo) {
    router.get('/yahoo', (req, res) => {
        const authUrl = openIdClients.yahoo.authorizationUrl({
            scope: 'openid',
        });

        console.log(`redirecting to ${authUrl}`);

        res.redirect(authUrl)
    });

    router.get('/cb-yahoo', bodyParser.urlencoded({extended: false}), redirectPatch, asyncHandler(async (req, res, next) => {
        const yahooOpenIdClient = openIdClients.yahoo;
        const code = req.query.code;

        const tokenSet = await yahooOpenIdClient.grant({
            code,
            grant_type  : 'authorization_code',
            redirect_uri: `${process.env.AUTH_CB_URL}/cb-yahoo`
        }).catch(err => {
            console.error(`error getting token set: ${err}`);
            return Promise.reject(err);
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
    }));
}

if (idpsEnabled.facebook) {
    router.get('/facebook', bodyParser.urlencoded({extended: false}), redirectPatch, asyncHandler(async (req, res, next) => {
        const state = generators.nonce();

        const stringifiedParams = queryString.stringify({
            client_id   : `255715555452255`,
            redirect_uri: `${process.env.AUTH_CB_URL}/cb-facebook`,
            scope       : ['email'].join(','),
            state
        });

        req.session.state = state;

        const facebookLoginUrl = `https://www.facebook.com/v4.0/dialog/oauth?${stringifiedParams}`;

        res.redirect(facebookLoginUrl);
    }));

    router.get('/cb-facebook', redirectPatch, asyncHandler(async (req, res, next) => {
        const stateExpected = req.session.state,
              stateReceived = req.query.state;

        if (stateExpected !== stateReceived) {
            const error = new Error('invalid state received');
            error.code = 400;
            return next(error);
        }

        const code = req.query.code;

        console.log('getting access token');

        const {data} = await axios({
            url   : 'https://graph.facebook.com/v4.0/oauth/access_token',
            method: 'get',
            params: {
                client_id    : process.env.AUTH_FB_APPLICATION_ID,
                client_secret: process.env.AUTH_FB_APPLICATION_SECRET,
                redirect_uri : `${process.env.AUTH_CB_URL}/cb-facebook`,
                code,
            },
        }).catch(err => {
            console.error(`error getting access token: ${err}`);
            return Promise.reject(err)
        });

        const accessToken = data.access_token;

        console.log('getting user data');

        const userData = await axios({
            url   : 'https://graph.facebook.com/me',
            method: 'get',
            params: {
                fields      : ['id', 'email', 'first_name', 'last_name'].join(','),
                access_token: accessToken,
            },
        }).then(res => res.data).catch(err => {
            console.error(`error getting user data: ${err}`);
            return Promise.reject(err);
        });

        req.session.user = {
            idp: 'facebook',
            ...userData
        };

        delete req.session.state;

        res.cookie('idp', 'facebook', {maxAge: 3600000 * 24 * 365 * 10});

        res.redirect('/');
    }));
}

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
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