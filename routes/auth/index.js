"use strict";

const router = require('express').Router();

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
    router.use(require('./google'));
}

if (idpsEnabled.yahoo) {
    router.use(require('./yahoo'));
}

if (idpsEnabled.facebook) {
    router.use(require('./facebook'));
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