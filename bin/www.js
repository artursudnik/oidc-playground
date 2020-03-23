"use strict";

process.chdir(require('path').join(__dirname, '..'));
require('dotenv-defaults').config();

const fs    = require('fs'),
      https = require('https');

const app         = require('../app'),
      oidcClients = require('../lib/oidcClients');

const server = https
    .createServer({
        key : fs.readFileSync('bin/server.key'),
        cert: fs.readFileSync('bin/server.cert'),
    }, app)
    .on('listening', () => {
        console.log(`listening on port ${process.env.PORT} (${process.env.BIND})`);
        console.log('access application on https://127.0.0.1:3000/')
    });

oidcClients().then(() => {
    server.listen(process.env.PORT, process.env.BIND);
}).catch((err) => {
    console.error(`start up error`);
    console.debug(err);
    process.exit(1);
});