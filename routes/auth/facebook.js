"use strict";

const axios        = require('axios'),
      asyncHandler = require('express-async-handler'),
      bodyParser   = require('body-parser'),
      {generators} = require('openid-client'),
      queryString  = require('querystring'),
      router       = require('express').Router();

module.exports = router;

router.get('/facebook', bodyParser.urlencoded({extended: false}), redirectPatch, asyncHandler(async (req, res, next) => {
    const state = generators.nonce();

    const stringifiedParams = queryString.stringify({
        client_id   : process.env.AUTH_FB_APPLICATION_ID,
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