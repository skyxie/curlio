
var utils = {};

utils.parseJSON = function(json, cb) {
  try {
    cb(null, JSON.parse(json));
  } catch(e) {
    cb(new Error("Could not parse JSON: '"+json+"' Error:"+e.message));
  }
};

utils.deepValue = function(obj, keys) {
  var key = keys.shift();
  var val = obj[key];
  if (keys.length == 0 && typeof(val) != "object" && typeof(val) != "Array") {
    return val;
  } else {
    return utils.deepValue(val, keys);
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

module.exports = utils;
