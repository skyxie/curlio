
'use strict';

var path = require("path");
var winston = require("winston");
var express = require("express");
var expressWinston = require("express-winston");
var bodyParser = require("body-parser");
var WebSocketServer = require('ws').Server;

var Request = require(path.join(__dirname, 'models', 'request'));
var RequestLoader = require(path.join(__dirname, 'models', 'request-loader'));
var LoggerRequestEvents = require(path.join(__dirname, 'models', 'logger-request-events'));
var WebSocketEvents = require(path.join(__dirname, 'models', 'web-socket-request-events'));
var utils = require(path.join(__dirname, 'lib', 'utils'));

var consoleLoggerTransport = new winston.transports.Console({
                               level: (process.env.LOG_LEVEL || "info"),
                               dumpExceptions : true,
                               showStack : true,
                               colorize : true
                             });

var transports = [ consoleLoggerTransport ];

var logger = new winston.Logger({"transports" : transports});

var app = express();

app.use(express.static("public"));
app.use(expressWinston.logger({"transports" : transports}));
app.use(expressWinston.errorLogger({"transports" : transports}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

var port = process.env.PORT || 8000;
app.listen(port, function() {
  logger.info("Server listening on port %d", port);
  app.get('/', function(req, res) {
    res.render("index.html.ejs", {'locals' : {'url' : req.param('url')}});
  });
});

// Setup WebSocketServer on port+1

var wss = new WebSocketServer({'port': port+1});

// Callback function to log sending errors
var sendCb = function(error) {
  if (error) {
    logger.error("Failed to send message: "+error);
  }
};

var requestLoader = new RequestLoader(logger);

var lre = new LoggerRequestEvents(logger);

wss.on('connection', function connection(ws) {

  var wse = new WebSocketEvents(ws, sendCb);

  ws.on('message', function incoming(message) {
    logger.debug("WebSocketServer receiving message: %s", message);

    utils.parseJSON(message, function(error, obj) {
      var request = new Request(obj, requestLoader);

      lre.attachListeners(request);
      wse.attachListeners(request);

      request.run(function(error) {
        if (error) {
          logger.error("Failed to run request: "+request.name);
        } else {
          logger.info("Successfully ran request: "+request.name);
        }
      });
    });
  });
});
