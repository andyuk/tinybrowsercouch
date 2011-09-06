
var TinyBrowserCouch = {};

TinyBrowserCouch.Replicator = {

	store: null,
	
	// changes waiting to be pushed to couchdb on next replication
	changes: null, 
	
	pull: function (couchdb, callback) {

		callback = callback || function() {};
		var self = this;

		var url = couchdb.url + '_changes?include_docs=true';

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
				if ("_deleted" in doc) {
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

		for (var key in self.changes) {

			var doc = self.changes[key];
			// Add new records

			var temp_doc;
			
			if ("_updated" in doc) {
				
				temp_doc = _.extend(self.store.data[doc._id]);
				delete temp_doc["_updated"];
				
			} else if ("_new" in doc) {

					temp_doc = _.extend(self.store.data[doc._id]);
					delete temp_doc["_new"];

			} else {
				// to delete
				var temp_doc = _.extend(doc);
			}

			if ("_revision" in temp_doc) {
				delete temp_doc["_revision"];
			}

			data.docs.push(temp_doc);
		}

		if (data.docs.length === 0) {
			
			if (callback) callback();
			return;
		}
		
		console.log('Pushing data:' + JSON.stringify(data));
		
		// send all updates in one bulk HTTP request
		$.ajax({
			url: couchdb.url + '_bulk_docs',
			type: 'POST',
			dataType: 'json',
			contentType: 'application/json',
			data: JSON.stringify(data),
			error: function() {
				console.log('Error returned from CouchDB when sending updates');
			},
			success: function(data) {
				self.parseBulkDocsResponse(data, callback);
			}
		});
		
	},
	
	parseBulkDocsResponse: function(records, callback) {

		console.log('_bulk_docs response from couch:');
		console.log(records);

		for (var i=0; i < records.length; i++) {

			var update = records[i];

			if (update.error) {
				console.log("Error for record: " + JSON.stringify(update));

			} else {
				// New, updated or deleted records

				var local_doc = this.store.findById(update.id);
				//debugger;
				this.removeChange(update.id);
				
				if ("_deleted" in local_doc) {

					this.store.destroy(local_doc);
					console.log('deleted:' + JSON.stringify(update));

				} else {
					// Update revision to the latest
					local_doc._rev = update.rev;

					this.store.update(local_doc);

					console.log('updated:' + JSON.stringify(update));
				}
			}
		}

		if (typeof(callback) === 'function') {
			callback();
		}
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
	},
	
	logChange: function(id, type) {
		
		console.log('logging change id:' + id + ', type: ' + type);
		this.changes.push({
			'_id': id,
			type: true
		});
    localStorage.setItem(this.name+'-changes', JSON.stringify(this.changes));	
	},
	removeChange: function(id) {
		// find and remove change from changes list.
		var change = _.detect(this.changes, function(o) {
			return o._id === id;
		});
		if (! change) {
			console.log('Warning: Could not find change ' + id);
		}
		this.changes = _.without(this.changes, change);
    localStorage.setItem(this.name+'-changes', JSON.stringify(this.changes));
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
	
	// Meta data tracked for CouchDB replication
  var changes = localStorage.getItem(this.name + '-changes');
  this.replicator.changes = (changes && JSON.parse(changes)) || [];
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
		this.replicator.logChange(model._id, '_new');		
    this.save();
    return model;
  },

  // Update a model by replacing its copy in `this.data`.
  update: function(model) {
	
		if ("attributes" in model) {
			
			model = model.attributes;
		}
		//model._updated = true;
		if ("_rev" in model) {
			
			this.replicator.logChange(model._id, '_updated');
		}
		
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

		console.log('destroying ' + model._id);
		
		if ("_rev" in model) {
			
			this.replicator.logChange(model._id, '_deleted');
		}

		delete this.data[model._id];
		
    return model;
  },

	replicator: TinyBrowserCouch.Replicator

});
