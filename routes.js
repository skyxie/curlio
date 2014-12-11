
var path = require("path");
var RequestController = require(path.resolve(__dirname, "controllers", "request-controller"));

var routing = function(app, logger) {
  var requestController = new RequestController(logger);

  app.post('/', requestController.run());
  app.get('/', requestController.index());
};

module.exports = routing;
