"use strict";

const router = require('express').Router();

module.exports = router;

router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

router.use((req, res, next) => {
    console.log(`received request: ${req.method} ${req.originalUrl}`);
    next();
});

router.use('/auth', require('./auth'));

router.get('/', authenticate, (req, res) => {
    res.render('index', {title: 'index page'});
});

router.use((error, req, res, next) => {
    res.render('error', {error})
});

function authenticate(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth')
    }
    next();
}