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

var attachListeners = function(request, index) {
  request.on('load_complete', function loadLogger(request, elapsedtime) {
    logger.info("%d) Load request %s completed in %d ms", index, request.name(), elapsedtime);

    if (request.prereq) {
      attachListeners(request.prereq, index);
    }
  });

  request.on('request_complete', function requestLogger(request, elapsedtime) {
    logger.info("%d) Send request %s completed in %d ms", index, request.name(), elapsedtime);

    var prettyBody = request.responseBody;
    if (typeof(request.responseBody) == "object") {
      prettyBody = JSON.stringify(prettyBody, undefined, 2);
    }

    logger.debug("%d) \nELAPSED TIME: %d\nSTATUS CODE: %d\nHEADERS: %s\nBODY:\n%s",
      index,
      elapsedtime,
      request.response.statusCode,
      _.reduce(request.response.headers, function(memo, val, key) { return memo + '\n  '+key+': '+val; }, ''),
      prettyBody
    );
  });

  request.on('run_complete', function runLogger(request, elapsedtime) {
    logger.info("%d) Run request %s completed in %d ms", index, request.name(), elapsedtime);
  });
};

Async.parallel(
  _.map(_.range(concurrency), function(i) {
    var request = new Request(opts, requestLoader, logger);
    
    attachListeners(request, i);

    request.run(function(error) {
      if (error) {
        logger.error("Failed to send request! - "+error.message+"\n"+error.stack);
      } else {
        logger.info("DONE");
      }
    });
  })
);
