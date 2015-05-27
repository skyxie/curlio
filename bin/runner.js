var http = require('http');
var path = require('path');

var Async = require('async');
var commander = require('commander');
var winston = require('winston');
var _ = require('underscore');

var Request = require(path.resolve('models', 'request'));
var RequestLoader = require(path.resolve('models', 'request-loader'));
var LoggerRequestEvents = require(path.resolve('models', 'logger-request-events'));

commander.version('0.0.1')
  .option('-c, --concurrency [c]', 'Run c concurrent requests')
  .option('-u, --url [url]', 'Pull requests from url')
  .option('-f, --file [file]', 'Pull requests from file')
  .option('-l, --loglevel [level]', 'Logging level')
  .parse(process.argv);

var loggerTransport = new winston.transports.Console({
  "level" : (commander.loglevel || 'info'),
  "dumpExceptions" : true,
  "showStack" : true,
  "colorize" : true
});

var logger = new winston.Logger({"transports" : [ loggerTransport ]});

var requestLoader = new RequestLoader(logger);

var lre = new LoggerRequestEvents(logger);

var opts = {"file" : commander.file, "url" : commander.url };

var concurrency = commander.concurrency || 1;

Async.parallel(
  _.map(_.range(concurrency), function(i) {
    var request = new Request(opts, requestLoader, logger);
    
    lre.attachListeners(request);

    request.run(function(error) {
      if (error) {
        logger.error("Failed to send request! - "+error.message+"\n"+error.stack);
      } else {
        logger.info("DONE");
      }
    });
  })
);
