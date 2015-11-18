
var Url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');
var ejs = require('ejs');
var events = require('events');
var node_util = require('util');

var _ = require('underscore');
var Async = require('async');
var querystring = require('querystring');

var utils = require(path.join('..', 'lib', 'utils'));

var Request = function(opts, requestLoader) {
  var self = this;

  self.requestLoader = requestLoader;

  self._loader = requestLoader.loadFunction(opts);
  self.parser = opts.parser;
  self.opts = opts;

  self._runTimer = new utils.Timer();
  self._loadTimer = new utils.Timer();
  self._requestTimer = new utils.Timer();
  self._pollResponses = [];

  return self;
};

node_util.inherits(Request, events.EventEmitter);

Request.prototype.loadReq = function(req) {
  this.request = req;
  this.url = Url.parse(req.url);
};

Request.prototype.loadObj = function(obj) {
  this.name = obj.name;
  this.parser = obj.parser;

  this.loadReq(obj.request);

  this.success = this.successFunction(obj.success);
  this.poll = this.pollFunction(obj.poll);

  if (obj.prereq) {
    this.prereq = new Request(obj.prereq, this.requestLoader);
  }
};

Request.prototype.loadFunction = function() {
  var self = this;

  return function load(cb) {
    self._loadTimer.start();
    self._loader(function(error, obj) {
      if (error) {
        self._loadTimer.stop();
        cb(error);
      } else {
        self.loadObj(obj);
        self.emit('load_complete', self, obj, self._loadTimer.stop());
        cb();
      }
    });
  };
};

Request.prototype.conditionFunction = function(conditionStr) {
  var self = this;

  return function customCondition() {
    var conditonResult = ejs.render(conditionStr, { 'responseBody' : self.responseBody, 'response' : self.response });
    self.emit('condition', self, conditionStr, conditonResult);
    return "1" === conditonResult;
  };
};

Request.prototype.successFunction = function(success) {
  var self = this;

  if (success) {
    return self.conditionFunction(success.condition);
  } else {
    // Default behavior for success is statusCode 20[0-9]
    return self.conditionFunction("<% if (/20[0-9]/.exec(response.statusCode)) { %>1<% } else { %>0<% } %>");
  }
};

Request.prototype.pollFunction = function(poll) {
  var self = this;

  if (poll) {
    self._pollInterval = poll.interval;
    return self.conditionFunction(poll.condition);
  } else {
    // Default behavior for polling is no polling
    return function() { return false; };
  }
};

Request.prototype.requestHeaders = function() {
  var self = this;

  var headers = self.request.headers;

  var body = self.requestBody();
  if (body) {
    headers['Content-Length'] = body.length;
  }

  return headers;
};

Request.prototype.requestBody = function() {
  var self = this;

  if (self.request.body && typeof(self.request.body) == "object") {
    return JSON.stringify(self.request.body);
  } else {
    return self.request.body;
  }
};

Request.prototype.runPrereqFunction = function() {
  var self = this;

  return function runPrereq(cb) {
    if (self.prereq) {
      self.prereq.run(cb);
    } else {
      cb();
    }
  };
};

Request.prototype.applyPrereqFunction = function() {
  var self = this;

  return function(cb) {
    if (self.prereq) {
      requestStr = ejs.render(JSON.stringify(self.request), { 'prereq' : self.prereq });

      utils.parseJSON(requestStr, function(error, obj) {
        self.loadReq(obj);
        cb(error);
      });
    } else {
      cb();
    }
  };
};

Request.prototype.sendRequestFunction = function() {
  var self = this;

  return function sendReq(cb) {
    var url = self.url;

    var protocol = (/^https/.exec(url.protocol) ? https : http);

    var request = protocol.request({
      "method" : self.request.method,
      "port" : self.request.port,
      "hostname" : url.hostname,
      "path" : url.path,
      "headers" : self.requestHeaders(),
      "strictSSL": false,
      "rejectUnauthorized" : false
    }, function(response) {
      utils.readResponseBody(response, cb);
    });

    request.on("error", cb);

    request.end(self.requestBody());
  };
};

Request.prototype.parseBodyFunction = function() {
  var self = this;

  return function parseBody(responseBody, response, cb) {
    if (/application\/.*json/.exec(response.headers['content-type']) || self.parser === "json") {
      utils.parseJSON(responseBody, function(error, obj) {
        if (error) {
          cb(error);
        } else {
          cb(null, obj, response);
        }
      });
    } else {
      // noop
      cb(null, responseBody, response);
    }
  };
};

Request.prototype.addResponse = function(responseBody, response) {
  var self = this;

  var delta = self._requestTimer.stop();
  self.response = response;
  self.responseBody = responseBody;

  self._pollResponses.push({
    "elapsed_time" : delta,
    "responseBody" : responseBody,
    "response" : response
  });

  self.emit('request_complete', self, delta);
};

Request.prototype.sendFunction = function() {
  var self = this;

  return function sendParsePoll(cb) {
    self._requestTimer.start();
    Async.waterfall(
      [
        self.sendRequestFunction(),
        self.parseBodyFunction()
      ], function poll(error, responseBody, response) {
        if (error) {
          cb(error);
        } else {
          self.addResponse(responseBody, response);
          if (self.success()) {
            // Success condition has been met
            cb();
          } else if (self.poll()) {
            // Poll condition has been met
            setTimeout(function() { sendParsePoll(cb); }, self._pollInterval);
          } else {
            cb(new Error("Sending request: "+self.request.method+" '"+self.request.url+"' failed with status: "+response.statusCode));
          }
        }
      }
    );
  };
};

Request.prototype.run = function(runCb) {
  var self = this;

  self._runTimer.start();

  Async.series(
    [
      self.loadFunction(),
      self.runPrereqFunction(),
      self.applyPrereqFunction(),
      self.sendFunction(),
    ],
    function runTimerCb(error) {
      if (error) {
        self.emit('run_error', self, error);
      } else {
        self.emit('run_complete', self, self._runTimer.stop());
      }
      self.removeAllListeners();
      runCb(error);
    }
  );
};

module.exports = Request;
