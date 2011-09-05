
var TinyBrowserCouch = {};

TinyBrowserCouch.Replicator = {

	store: null,
	
	pull: function (couchdb, callback) {

		callback = callback || function() {};
		var self = this;

		var url = couchdb.url + '_changes';

		// If we've done a pull before, skip to the last update
		/*var last_seq = localStorage.getItem(this.store.name + '-last-seq');
		if (last_seq !== null) {
			url += '?since=' + last_seq;
		}*/
		
		$.getJSON(url, function(data) {

			$('#couchdb').append('<p>' + JSON.stringify(data)  + '</p>');

			// Loop through all couch records,
			var results = data.results;

			console.log('receiving changes ' + results.length);

			for (var i=0; i<results.length; i++) {

				var doc = results[i].doc;

				// if record has been deleted, remove from local
				if (doc._deleted) {
					if (self.store.exists(doc._id)) {
						self.store.destroy(doc);
					}

				// if local exists
				} else if (self.store.exists(doc._id)) {

					var local_doc = self.store.find(doc);

					if (doc._rev === local_doc._rev) {
						// skip when revisions are identical
						console.log('intentical revs');
					} else {
						if (self.isMostRecentRev(local_doc, doc)) {
							
							console.log('local is more up-to-date, should push');
							// Remote CouchDB version is out of date
							// Don't update, since we are only updating the local storage
						} else {
							self.store.update(doc);
							console.log('updating local doc');
						}
					}

				} else {

					// if no local exists, add to local	
					self.store.create(doc);
				}
			}

			// store sequence number so it can be used next time
			localStorage.setItem(self.store.name + '-last-seq', data.last_seq)
			
			if (typeof(callback) === 'function') {
				callback();
			}
		});
	}, 

	push: function (couchdb, callback) {

		var self = this;

		var data = {
									"docs": []
									};

		for (var key in self.store.data) {

			var doc = self.store.data[key];
			// Add new records

			var temp_doc = _.extend(doc);
			
			
			if ("_updated" in temp_doc) {
				delete temp_doc["_updated"];
			}

			if ("_rev" in doc) {

				if ("_revision" in temp_doc) {
					delete temp_doc["_revision"];
				}
				
				if ("_updated" in doc || "_deleted" in doc) {

					data.docs.push(temp_doc);

				} else {

					// Record has not been updated.
				}

				// TODO: it would be better generating the new revision number in JS, but this doesn't look straight forward
				// See: http://stackoverflow.com/questions/5954864/how-does-couchdb-calculate-the-revision-number

			} else  {
				// no _rev means it's a brand new record
				data.docs.push(doc);
			}
		}

		if (data.docs.length === 0) {
			
			if (typeof(callback) === 'function') {
				callback();
			}
			return;
		}
		
		console.log('Pushing data:' + JSON.stringify(data));
		
		// send all updates in one bulk HTTP request
		$.post(couchdb.url + '_bulk_docs', {"data": JSON.stringify(data) }, 
			function(records) {

				console.log('_bulk_docs response from couch:');
				console.log(records);

				for (var i=0; i < records.length; i++) {

					var update = records[i];

					if (update.error) {
						console.log("Error for record: " + JSON.stringify(update));

					} else {
						// Updated or new record

						var local_doc = self.store.findById(update.id);

						if ("_deleted" in local_doc) {

							self.store.destroy(local_doc);
							console.log('deleted:' + JSON.stringify(update));

						} else {
							// Update revision to the latest
							local_doc._rev = update.rev;
							delete local_doc["_updated"];
							
							self.store.update(local_doc);

							console.log('updated:' + JSON.stringify(update));
						}
					}
				}
				
				if (typeof(callback) === 'function') {
					callback();
				}
				
			}, "json"
		);	// end of $.post()	
	},
	
	isMostRecentRev: function(a, b) {

		if (a._revision === undefined) {
			this.addRevInfo(a);
		}
		if (b._revision === undefined) {
			this.addRevInfo(b);
		}
		return a._revision.number > b._revision.number;
	},

	addRevInfo: function(doc) {
		if (doc._rev) {
	      var revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
	      if (!revInfo) throw "invalid value for property '_rev'";
	      doc._revision = {
	        number : parseInt(revInfo[1]) + 1
	      };
	  } else {
		  doc._revision = {
		   number : 1
		  };
	  }
	}
	
};

TinyBrowserCouch.CouchDB = function(couch_url) {
  this.url = couch_url;
};

// A simple wrapper for local storage persistence. 
// This code came from from Backbone.js (http://documentcloud.github.com/backbone/)

// Generate four random hex digits.
function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
};

// Generate a pseudo-GUID by concatenating random hexadecimal.
function guid() {
   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
};

// Our Store is represented by a single JS object in *localStorage*. Create it
// with a meaningful name, like the name you'd give a table.
TinyBrowserCouch.LocalStorage = function(name) {
  this.name = name;
  var store = localStorage.getItem(this.name);
  this.data = (store && JSON.parse(store)) || {};
	this.replicator.store = this;
};

_.extend(TinyBrowserCouch.LocalStorage.prototype, {

  // Save the current state of the **Store** to *localStorage*.
  save: function() {
    localStorage.setItem(this.name, JSON.stringify(this.data));
  },

  // Add a model, giving it a (hopefully)-unique GUID, if it doesn't already
  // have an id of it's own.
  create: function(model) {
    if (!model._id) model._id = model.attributes._id = guid();
    this.data[model._id] = model;
    this.save();
    return model;
  },

  // Update a model by replacing its copy in `this.data`.
  update: function(model) {
	
		if ("attributes" in model) {
			
			model = model.attributes;
		}
		model._updated = true;

		if (model._id == undefined) {
			console.log('no model._id! :');
			console.log(model);
		}

    this.data[model._id] = model;
    this.save();
    return model;
  },

	exists: function(id) {
		
		return id in this.data;
	},

  // Retrieve a model from `this.data` by id.
  find: function(model) {
    return this.data[model._id];
  },

  findById: function(id) {
    return this.data[id];
  },

  // Return the array of all models currently in storage.
  findAll: function() {
    return _.values(this.data);
  },

  // Delete a model from `this.data`, returning it.
  destroy: function(model) {
	
		if ("attributes" in model) {
			
			model = model.attributes;
		}

		model._deleted = true;
		if (("_rev" in model) === false) {
			
			delete this.data[model._id];
			
			console.log('destroying ' + model._id);
			
		} else {
			
			this.update(model);
			console.log('flagging as deleted ' + model._id);
		}
		
    return model;
  },

	replicator: TinyBrowserCouch.Replicator

});
