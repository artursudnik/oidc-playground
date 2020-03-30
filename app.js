"use strict";

const express = require('express'),
      Redis   = require('ioredis'),
      session = require('express-session');

const RedisStore  = require('connect-redis')(session),
      redisClient = new Redis({
          host     : process.env.REDIS_HOST,
          port     : process.env.REDIS_PORT,
          keyPrefix: process.env.REDIS_PREFIX,
      });

let redisReady = false;

// [
//     'connect',
//     'ready',
//     'error',
//     'close',
//     'reconnecting',
//     'end',
//     '+node',
//     '-node',
//     'node error'
// ].forEach(eventName => redisClient.on(eventName, () => console.log(`${new Date().toISOString()} "${eventName}" redis event emitted`)));

redisClient.on('connect', () => {
    console.log('established redis server connection');
    redisReady = true;
});
redisClient.on('ready', () => {
    console.log('redis server client ready');
    redisReady = true;
});
redisClient.on('close', () => {
    console.log('redis server connection closed');
    redisReady = false;
});
redisClient.on('reconnecting', () => {
    console.log('reconnecting to redis server');
    redisReady = false;
});
redisClient.on('end', () => {
    console.log('Fatal error: no more connection attempts to redis server will be made, exiting');
    process.exit(1);
});
redisClient.on('error', (error) => console.error(`${error}`));

const app = express();

module.exports = app;

app.set('view engine', 'pug');

const redisStore = new RedisStore({client: redisClient});

app.use((req, res, next) => {
    if (!redisReady) {
        return next(new Error('connection to redis serer broken'));
    }
    next();
});

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



