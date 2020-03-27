"use strict";

const express = require('express'),
      redis   = require('redis'),
      session = require('express-session');

const RedisStore  = require('connect-redis')(session),
      redisClient = redis.createClient({
          host  : process.env.REDIS_HOST,
          port  : process.env.REDIS_PORT,
          prefix: process.env.REDIS_PREFIX
      });

redisClient.on('error', (error) => {
    console.error(`${error}`);
});

const app = express();

module.exports = app;

app.set('view engine', 'pug');

const redisStore = new RedisStore({client: redisClient});

app.use(require('cookie-parser')());

app.use(session({
    name             : process.env.SESSION_COOKIE_NAME,
    secret           : 'keyboard cat',
    resave           : false,
    saveUninitialized: false,
    rolling          : true,
    cookie           : {secure: false, maxAge: parseInt(process.env.SESSION_MAX_AGE) * 1000 || undefined},
    store            : redisStore
}));

app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.loggedIn = true;
    }

    res.locals.session = req.session;
    res.locals.sessionId = req.session.id;

    next();
});

app.use(require('./routes'));



