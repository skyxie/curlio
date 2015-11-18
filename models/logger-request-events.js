
var _ = require('underscore');

LoggerRequestEvents = function(logger) {
  this.logger = logger;
};

LoggerRequestEvents.prototype.attachLoadComplete = function(request) {
  var self = this;
  request.on('load_complete', function logLoadComplete(request, loadObj, elapsedtime) {
    self.logger.info("Load request %s completed in %d ms", request.name, elapsedtime);
    self.logger.debug("Loaded request object: \n%s", JSON.stringify(loadObj, undefined, 2));

    if (request.prereq) {
      self.attachListeners(request.prereq);
    }
  });
};

LoggerRequestEvents.prototype.attachRequestComplete = function(request) {
  var self = this;
  request.on('request_complete', function logRequestComplete(request, elapsedtime) {
    self.logger.info("Send request %s completed in %d ms", request.name, elapsedtime);

    var prettyBody = request.responseBody;
    if (typeof(request.responseBody) == "object") {
      prettyBody = JSON.stringify(prettyBody, undefined, 2);
    }

    var prettyHeaders = _.reduce(
      request.response.headers,
      function(memo, val, key) {
        return memo + '\n  '+key+': '+val;
      }, '');

    self.logger.debug("\nELAPSED TIME: %d\nSTATUS CODE: %d\nHEADERS: %s\nBODY:\n%s",
      elapsedtime, request.response.statusCode, prettyHeaders, prettyBody);
  });
};

LoggerRequestEvents.prototype.attachCondition = function(request) {
  var self = this;
  request.on('condition', function logCondition(request, conditionStr, conditionResult) {
    self.logger.debug("Request %s evaluated condition \"%s\" with result %s", request.name, conditionStr, conditionResult);
  });
};

LoggerRequestEvents.prototype.attachRunError = function(request) {
  var self = this;
  request.on('run_error', function logRunError(request, error) {
    self.logger.error("Encountered error on request: %s - %s", request.name, error.message);
  });
};

LoggerRequestEvents.prototype.attachRunComplete = function(request) {
  var self = this;
  request.on('run_complete', function runComplete(request, elapsedtime) {
    self.logger.info("Request %s completed successfully in %d ms", request.name, elapsedtime);
  });
};

LoggerRequestEvents.prototype.attachListeners = function(request) {
  this.attachLoadComplete(request);
  this.attachRequestComplete(request);
  this.attachCondition(request);
  this.attachRunError(request);
  this.attachRunComplete(request);
};

module.exports = LoggerRequestEvents;
