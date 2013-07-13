'use strict';

// This is only used during development since apart from the dynamic bundle, all resources can be served statically
var http         =  require('http')
  , ecstatic     =  require('ecstatic')
  , build        =  require('./tools/build')
  , staticServer =  ecstatic({ root: __dirname, autoIndex: true });

http.createServer(function (req, res) {
  return req.url === '/client/.bundle.js' ? serveBundle(req, res) : staticServer(req, res);
}).listen(3000);

console.log('Listening: http://localhost:3000');

function serveBundle(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  build().pipe(res);
}
