
var path = require('path');
var _ = require('underscore');

var Request = require(path.resolve('models', 'request'));
var RequestLoader = require(path.resolve('models', 'request-loader'));

var RequestController = function(logger) {
  var self = this;

  self.logger = logger;
  self.requestLoader = new RequestLoader(logger);
};

RequestController.prototype.attachListeners = function(request) {
  var self = this;

  request.on('load_complete', function loadLogger(request, elapsedtime) {
    self.logger.info("Load request %s completed in %d ms", request.name(), elapsedtime);

    if (request.prereq) {
      self.attachListeners(request.prereq);
    }
  });

  request.on('request_complete', function requestLogger(request, elapsedtime) {
    self.logger.info("Send request %s completed in %d ms", request.name(), elapsedtime);

    var prettyBody = request.responseBody;
    if (typeof(request.responseBody) == "object") {
      prettyBody = JSON.stringify(request.responseBody, undefined, 2);
    }

    self.logger.debug("\nELAPSED TIME: %d\nSTATUS CODE: %d\nHEADERS: %s\nBODY:\n%s",
      elapsedtime,
      request.response.statusCode,
      _.reduce(request.response.headers, function(memo, val, key) { return memo + '\n  '+key+': '+val; }, ''),
      prettyBody
    );
  });

  request.on('run_complete', function runLogger(request, elapsedtime) {
    self.logger.info("Run request %s completed in %d ms", request.name(), elapsedtime);
  });
};

RequestController.prototype.index = function() {
  var self = this;

  return function index(req, res) {
    res.render("index.html.ejs", {'locals' : {'url' : req.param('url')}});
  };
};

RequestController.prototype.run = function() {
  var self = this;

  return function run(req, res) {
    var url = req.param('url');
    if (!url) {
      res.status(400).json({'error' : {'message' : 'missing url'}});
    } else {
      var r = new Request({'url' : url}, self.requestLoader);

      self.attachListeners(r);

      r.run(function(error) {
        if (error) {
          res.status(400).json({
            'error' : {
              'message' : error.message,
              'stack' : error.stack
            }
          });
        } else {
          res.status(200).json({
            'request' : r.request,
            'response' : {
              'headers' : r.response.headers,
              'body' : r.responseBody
            }
          });
        }
      });
    }
  }
};

module.exports = RequestController;
