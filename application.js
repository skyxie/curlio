
'use strict';

var path = require("path");
var winston = require("winston");
var express = require("express");
var expressWinston = require("express-winston");
var bodyParser = require("body-parser");

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

require(path.resolve(__dirname, "routes"))(app, logger);

var port = process.env.PORT || 8000;
app.listen(port, function() {
  logger.info("Server listening on port %d", port);
});
