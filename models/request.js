
var Url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');
var ejs = require('ejs');

var _ = require('underscore');
var Async = require('async');
var querystring = require('querystring');

var utils = require(path.join('..', 'lib', 'utils'));

var Request = function(opts, requestLoader, logger) {
  var self = this;

  self.requestLoader = requestLoader;

  self._loader = requestLoader.loadFunction(opts);
  self.parser = opts.parser;
  self.opts = opts;
  self.logger = logger;

  return self;
};

Request.prototype.loadReq = function(req) {
  this.request = req;
  this.url = Url.parse(req.url);
};

Request.prototype.loadObj = function(obj) {
  this.metadata = obj.metadata;
  this.parser = obj.parser;

  this.loadReq(obj.request);

  this.success = this.successFunction(obj.success);
  this.poll = this.pollFunction(obj.poll);

  if (obj.prereq) {
    this.prereq = new Request(obj.prereq, this.requestLoader, this.logger);
  }
};

Request.prototype.loadFunction = function() {
  var self = this;

  return function load(cb) {
    self._loader(function(error, obj) {
      if (error) {
        cb(error);
      } else {
        self.loadObj(obj);
        cb();
      }
    });
  };
};

Request.prototype.conditionFunction = function(conditionStr) {
  var self = this;

  return function customCondition() {
    return "1" === ejs.render(conditionStr, { 'locals': {'responseBody' : self.responseBody, 'response' : self.response}});
  };
};

Request.prototype.successFunction = function(successStr) {
  var self = this;

  if (successStr) {
    return self.conditionFunction(successStr);
  } else {
    // Default behavior for success is statusCode 20[0-9]
    return self.conditionFunction("<% if (/20[0-9]/.exec(response.statusCode)) { %>1<% } else { %>0<% } %>");
  }
};

Request.prototype.pollFunction = function(pollStr) {
  var self = this;

  if (pollStr) {
    return self.conditionFunction(pollStr)
  } else {
    // Default behavior for polling is no polling
    return function() { return false; }
  }
};

Request.prototype.requestHeaders = function() {
  var self = this;

  var headers = self.request.headers;

  if (self.request.body) {
    headers['Content-Length'] = self.requestBody().length;
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
      requestStr = ejs.render(JSON.stringify(self.request), {'locals' : { 'prereq' : self.prereq }});

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
    self.logger.debug("Sending request: "+self.request.method+" '"+self.request.url+"'", self.metadata);

    var url = self.url;

    var protocol = (/^https/.exec(url.protocol) ? https : http);

    var request = protocol.request({
      "method" : self.request.method,
      "port" : self.request.port,
      "hostname" : url.hostname,
      "path" : url.path,
      "headers" : self.requestHeaders()
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
    var logResponse = function(body, resp) {
      self.logger.info(
        "\nSTATUS CODE: "+resp.statusCode+
        "\nHEADERS: "+_.reduce(resp.headers, function(memo, val, key) { return memo + '\n  '+key+': '+val; }, '')+
        "\nBODY:\n"+body
      );
    };

    if (/application\/.*json/.exec(response.headers['content-type']) || self.parser === "json") {
      utils.parseJSON(responseBody, function(error, obj) {
        if (error) {
          cb(error);
        } else {
          var responseBodyStr = JSON.stringify(obj, undefined, 2);
          logResponse(responseBodyStr, response);
          cb(null, obj, response)
        }
      });
    } else {
      // noop
      logResponse(responseBody, response);
      cb(null, responseBody, response)
    }
  };
};

Request.prototype.setResponseFunction = function() {
  var self = this;

  return function setResponse(responseBody, response, cb) {
    self.response = response;
    self.responseBody = responseBody;
    cb();
  };
};

Request.prototype.sendFunction = function() {
  var self = this;

  return function sendParsePoll(cb) {
    Async.waterfall(
      [
        self.sendRequestFunction(),
        self.parseBodyFunction(),
        self.setResponseFunction()
      ], function poll(error) {
        if (error) {
          cb(error);
        } else {
          if (self.success()) {
            // Success condition has been met
            cb();
          } else if (self.poll()) {
            // Poll condition has been met
            setTimeout(function() {sendParsePoll(cb); }, 10000);
          } else {
            cb(new Error("Sending request: "+self.request.method+" '"+self.request.url+"'"));
          } 
        }
      }
    );
  };
};

Request.prototype.run = function(runCb) {
  var self = this;

  Async.waterfall(
    [
      self.loadFunction(),
      self.runPrereqFunction(),
      self.applyPrereqFunction(),
      self.sendFunction(),
    ],
    runCb
  );
};

module.exports = Request;
