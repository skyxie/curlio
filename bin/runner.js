var http = require('http');
var path = require('path');

var Async = require('async');
var commander = require('commander');
var winston = require('winston');
var _ = require('underscore');

var Request = require(path.resolve('models', 'request'));
var RequestLoader = require(path.resolve('models', 'request-loader'));

var loggerTransport = new winston.transports.Console({
  "level" : (process.env.LOG_LEVEL || 'info'),
  "dumpExceptions" : true,
  "showStack" : true,
  "colorize" : true
});

var logger = new winston.Logger({"transports" : [ loggerTransport ]});

commander.version('0.0.1')
  .option('-c, --concurrency [c]', 'Run c concurrent requests')
  .option('-u, --url [url]', 'Pull requests from url')
  .option('-f, --file [file]', 'Pull requests from file')
  .parse(process.argv);

var opts = {"file" : commander.file, "url" : commander.url };

var requestLoader = new RequestLoader(logger);

var concurrency = commander.concurrency || 1;

Async.parallel(
  _.map(_.range(concurrency), function(i) {
    var request = new Request(opts, requestLoader, logger);

    request.run(function(error, responseBody, response) {
      if (error) {
        logger.error("Failed to send request! - "+error.message);
      } else {
        logger.info("DONE");
      }
    }, logger);
  })
);
