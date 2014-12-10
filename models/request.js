
var Url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');

var _ = require('underscore');
var Async = require('async');
var querystring = require('querystring');

var utils = require(path.join('..', 'lib', 'utils'));

var Request = function(opts, requestLoader, logger) {
  var self = this;

  self.requestLoader = requestLoader;

  self.load = requestLoader.loadFunction(opts);

  self.parser = opts.parser;

  self.opts = opts;

  self.logger = logger;

  return self;
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

Request.prototype.loadObjFunction = function() {
  var self = this;

  return function loadObj(obj, cb) {
    self.logger.debug("Loading request", obj);
    
    self.metadata = obj.metadata;
    self.parser = obj.parser;
    self.request = obj.request;

    if (obj.prereq) {
      self.prereq = new Request(obj.prereq, self.requestLoader, self.logger);
    }

    cb();
  };
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

  return function(responseBody, repsonse, cb) {
    if (self.prereq) {
      var requestStr = JSON.stringify(self.request);

      requestStr = requestStr.replace(/#{response(Body)?\.([^}]*)}/, function(fullMatch, bodyMatch, keysMatch) {
        var result = utils.deepValue((bodyMatch ? responseBody : response), keysMatch.split('.'));
        self.logger.debug("Replacing '"+fullMatch+"' with '"+result+"'", self.metadata);
        return result;
      });

      requestStr = requestStr.replace(/#{request\.([^}]*)}/, function(fullMatch, keysMatch) {
        var result = utils.deepValue(self.prereq.request, keysMatch.split('.'));
        self.logger.debug("Replacing '"+fullMatch+"' with '"+result+"'", self.metadata);
        return result;
      });

      utils.parseJSON(requestStr, function(error, obj) {
        self.request = obj;
        cb(error);
      });
    } else {
      cb = responseBody;
      cb();
    }
  };
};

Request.prototype.sendRequestFunction = function() {
  var self = this;

  return function sendReq(cb) {
    self.logger.debug("Sending request: "+self.request.method+" '"+self.request.url+"'", self.metadata);

    var url = Url.parse(self.request.url);

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
    if (/application\/.*json/.exec(response.headers['content-type']) || self.parser === "json") {
      utils.parseJSON(responseBody, function(error, obj) {
        var responseBodyStr = JSON.stringify(obj, undefined, 2);
        self.logger.info(
          "\nSTATUS CODE: "+response.statusCode+
          "\nHEADERS: "+_.reduce(response.headers, function(memo, val, key) { return memo + '\n  '+key+': '+val; }, '')+
          "\nBODY:\n"+responseBodyStr
        );

        cb(error, obj, response);
      });
    } else {
      // noop
      self.logger.info(
        "\nSTATUS CODE: "+response.statusCode+
        "\nHEADERS: "+_.reduce(response.headers, function(memo, val, key) { return memo + '\n  '+key+': '+val; }, '')+
        "\nBODY:\n"+responseBody
      );
      cb(null, responseBody, response);
    }
  };
};

Request.prototype.run = function(runCb) {
  var self = this;

  var tasks = [
    self.load,
    self.loadObjFunction(),
    self.runPrereqFunction(),
    self.applyPrereqFunction(),
    self.sendRequestFunction(),
    self.parseBodyFunction()
  ];

  Async.waterfall(tasks, runCb);
};

module.exports = Request;
