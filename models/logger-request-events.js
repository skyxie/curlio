
LoggerRequestEvents = function(logger) {
  this.logger = logger;
};

LoggerRequestEvents.prototype.attachLoadComplete = function(request) {
  var self = this;
  request.on('load_complete', function logLoadComplete(request, elapsedtime) {
    self.logger.info("Load request %s completed in %d ms", request.name(), elapsedtime);
  });
};

LoggerRequestEvents.prototype.attachRequestComplete = function(request) {
  var self = this;
  request.on('request_complete', function logRequestComplete(request, elapsedtime) {
    self.logger.info("Send request %s completed in %d ms", request.name(), elapsedtime);
  });
};

LoggerRequestEvents.prototype.attachRunError = function(request) {
  var self = this;
  request.on('run_error', function logRunError(request, error) {
    self.logger.error("Encountered error on request: %s - %s", request.name(), error.message);
  });
};

LoggerRequestEvents.prototype.attachRunComplete = function(request) {
  var self = this;
  request.on('run_complete', function runComplete(request, elapsedtime) {
    self.logger.info("Request %s completed successfully in %d ms", request.name(), elapsedtime);
  });
};

LoggerRequestEvents.prototype.attachListeners = function(request) {
  this.attachLoadComplete(request);
  this.attachRequestComplete(request);
  this.attachRunError(request);
  this.attachRunComplete(request);
};

module.exports = LoggerRequestEvents;