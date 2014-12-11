
var utils = {};

utils.parseJSON = function(json, cb) {
  try {
    cb(null, JSON.parse(json));
  } catch(e) {
    e.message = "Could not parse JSON: '"+json+"' - "+e.message;
    cb(e);
  }
};

utils.readResponseBody = function(response, cb) {
  var responseBody = '';
  
  response.on('data', function(chunk) {
    responseBody += chunk;
  });

  response.on('error', cb);

  response.on('end', function() {
    cb(null, responseBody, response);
  });
};

var Timer = function() {
  this._start;
  this._end;
};

Timer.prototype.start = function() {
  delete this._stop;
  this._start = (new Date()).getTime();
};

Timer.prototype.stop = function() {
  this._stop = (new Date()).getTime();
  return this.delta();
};

Timer.prototype.delta = function() {
  if (this._start && this._stop) {
    return this._stop - this._start;
  } else {
    return; // undefined
  }
};

utils.Timer = Timer;

module.exports = utils;
