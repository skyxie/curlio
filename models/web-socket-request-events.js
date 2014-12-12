WebSocketRequestEvents = function(ws, cb) {
  this.ws = ws;
  this.cb = cb;
};

WebSocketRequestEvents.prototype.attachLoadComplete = function(request) {
  var self = this;
  request.on('load_complete', function sendLoadComplete(request, elapsedtime) {
    self.ws.send(JSON.stringify({
      'event' : 'load_complete',
      'request_name' : request.name,
      'elapsedtime' : elapsedtime
    }), self.cb);

    if (request.prereq) {
      self.attachListeners(request.prereq);
    }
  });
};

WebSocketRequestEvents.prototype.attachRequestComplete = function(request) {
  var self = this;
  request.on('request_complete', function sendRequestComplete(request, elapsedtime) {
    self.ws.send(JSON.stringify({
      'event' : 'request_complete',
      'request' : request.request,
      'response' : {
        'headers' : request.response.headers,
        'body' : request.responseBody
      },
      'elapsedtime' : elapsedtime
    }), self.cb);
  });
};

WebSocketRequestEvents.prototype.attachRunError = function(request) {
  var self = this;
  request.on('run_error', function sendRunError(request, error) {
    self.ws.send(JSON.stringify({
      'event' : 'run_error',
      'error' : {
        'message' : error.message,
        'stack' : error.stack
      }
    }), self.cb);
  });
};

WebSocketRequestEvents.prototype.attachRunComplete = function(request) {
  var self = this;
  request.on('run_complete', function sendComplete(request, elapsedtime) {
    self.ws.send(JSON.stringify({
      'event' : 'run_complete',
      'request_name' : request.name,
      'elapsedtime' : elapsedtime
    }), self.cb);
  });
};

WebSocketRequestEvents.prototype.attachListeners = function(request) {
  this.attachLoadComplete(request);
  this.attachRequestComplete(request);
  this.attachRunError(request);
  this.attachRunComplete(request);
};

module.exports = WebSocketRequestEvents;
