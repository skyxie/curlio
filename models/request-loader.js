
var Url = require('url');
var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');

var _ = require('underscore');
var Async = require('async');
var querystring = require('querystring');

var utils = require(path.join('..', 'lib', 'utils'));

var RequestLoader = function(logger) {
  var self = this;

  self.logger = logger;
  self.cache = {'file' : {}, 'url' : {}};
};

RequestLoader.prototype.setCacheFunction = function(type, key) {
  var self = this;
  
  return function setCache(obj, cb) {
    self.logger.debug("Setting request to cache at "+type+"."+key);
    self.cache[type][key] = obj;
    cb(null, obj);
  };
};

RequestLoader.prototype.loadUrlFunction = function(urlStr) {
  var self = this;

  return function loadUrl(loadUrlCb) {
    if (self.cache.url[urlStr]) {
      self.logger.debug("Loading request object from cache at url.%s", urlStr);
      loadUrlCb(null, self.cache.url[urlStr]);
    } else {
      self.logger.debug("Loading request object from url: %s", urlStr);
      Async.waterfall([
        function request(cb) {
          var url = Url.parse(urlStr);

          var protocol = (/^https/.exec(url.protocol) ? https : http);

          var get = protocol.request({
            'method' : 'GET',
            'hostname' : url.hostname,
            'path' : url.path
          }, function(response) {
            cb(null, response);
          });

          get.on('error', cb);
          get.end();
        },
        utils.readResponseBody,
        function parseResponseBody(responseBody, response, cb) {
          utils.parseJSON(responseBody, cb);
        },
        self.setCacheFunction('url', urlStr)
      ], loadUrlCb);
    }
  };
};

RequestLoader.prototype.loadFileFunction = function(file) {
  var self = this;
  
  return function loadFile(loadFileCb) {
    if (self.cache.file[file]) {
      self.logger.debug("Loading request object from cache at %s.%s", 'file', file);
      loadFileCb(null, self.cache.file[file]);
    } else {
      self.logger.debug("Loading request object from file: %s", file);
      Async.waterfall([
        function readFile(cb) { fs.readFile(file, cb); },
        function parseBuffer(buffer, cb) { utils.parseJSON(buffer.toString(), cb); },
        self.setCacheFunction('file', file)
      ], loadFileCb);
    }
  };
};

RequestLoader.prototype.loadFunction = function(opts) {
  var self = this;

  if (opts.file) {
    return self.loadFileFunction(opts.file);
  } else if (opts.url) {
    return self.loadUrlFunction(opts.url);
  } else {
    return function(loadCb) { loadCb(null, opts); }
  }
};

module.exports = RequestLoader;