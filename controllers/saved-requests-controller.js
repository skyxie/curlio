
var ObjectID = require('mongodb').ObjectID;
var _ = require('underscore');

var savedRequestsPath = 'saved_requests';

SavedRequestsController = function(logger, collection) {
  this.logger = logger;
  this.collection = collection;
};

SavedRequestsController.prototype.createRoute = function() {
  var self = this;

  return function create(req, res) {
    var savedReq = req.body;
    self.logger.info("Attempting to insert doc: ", savedReq);

    self.collection.insert([savedReq], function insertQuery(error, docs) {
      if (error) {
        res.status(400).json({ 'error' : {'message' : error.message, 'stack' : error.stack}});
      } else {
        res.status(201).json({ 'url' : req.protocol+'://'+req.hostname+'/'+savedRequestsPath+'/'+docs[0]._id});
      }
    });
  };
};

SavedRequestsController.prototype.showRoute = function() {
  var self = this;

  return function show(req, res) {
    var objId = ObjectID.createFromHexString(req.param('id'));
    self.collection.findOne({ _id : objId }, function showQuery(error, doc) {
      if (error) {
        self.logger.error("Failed to find saved request %s - %s", req.param('id'), error.message);
        res.status(404).end();
      } else {
        self.logger.info("Found saved request "+req.param('id'), doc);
        res.status(200).json(_.omit(doc, '_id'));
      }
    });
  };
};

SavedRequestsController.prototype.attach = function(app) {
  app.get('/'+savedRequestsPath+'/:id', this.showRoute());
  app.post('/'+savedRequestsPath, this.createRoute());
}

module.exports = SavedRequestsController;