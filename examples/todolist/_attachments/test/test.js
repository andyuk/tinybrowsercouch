var db_name = 'tinybrowsercouch-tests';
var $couchdb;
var $tinycouch;

module('Main', {
	
 setup: function() {

		stop();

		// Remove all local storage
		delete localStorage[db_name];

		// drop (if exists) and create couch database
		$couchdb = $.couch.db(db_name);
	
		$.ajax({
			url: $couchdb.uri,
			type: 'GET',
			dataType: 'json',
		 	success: function (data) {
				//console.log('Test DB exists');

				dropCouchDB(function() {
					createCouchDB(function() {
						start();
					});
				});
			 },
			 error: function(xhr, textStatus, error) {
				//console.log('Test DB does not exist');
				createCouchDB(function() {
					start();
				});
			 }
		});

		$tinycouch = new TinyBrowserCouch.LocalStorage(db_name);
		$tinycouch.remote = new TinyBrowserCouch.CouchDB('/' + db_name + '/');	
	},
	teardown: function() {
		
		stop();
		// Remove all local storage
		delete localStorage[db_name];

		dropCouchDB(function() {
			start();
		});
	}
});

function createCouchDB(callback) {
	
	$couchdb.create({
	 success: function (data) {
		//console.log('Created CouchDB DB');
		if (typeof(callback) === 'function') {
			callback();
		}
	 }
	});
}
function dropCouchDB(callback) {

	$couchdb.drop({
	 success: function (data) {
		//console.log('Dropped CouchDB DB');	
		if (typeof(callback) === 'function') {
			callback();
		}
	 }
	});
}

// Test
asyncTest("Test connection", 1, function() {
	
	console.log('# Test connection');
	$couchdb.info({
	 success: function (data) {
		console.log('Got DB info OK');
		start();
		ok(true);
	 }
	});
});


// Test
asyncTest("Add CouchDB doc", 2, function() {
	
	console.log('# Add CouchDB doc');
	addCouchDoc('testdoc', function() {
		start();
		ok(true);
	});
});

var addCouchDoc = function(name, callback) {

	var doc = {
		"name": name
	};
	
	$couchdb.saveDoc(doc, {
	 success: function (data) {
		console.log('Saved ' + JSON.stringify(doc));
		ok(true);
		
		if (callback) callback();
	 }
	});
};


// Test
test("Add localStorage doc", 1, function() {
	
	console.log('# Add localStorage doc');
	addLocalDoc();
});

var addLocalDoc = function (name) {

	var doc = new Backbone.Model({
		"name": name
	});
	
	$tinycouch.create(doc);
	$tinycouch.save();
	equal($tinycouch.findAll().length, 1, '1 doc found');
};


// Test
asyncTest("Replicate to Couch, 2 docs should exist", 5, function() {

	console.log('# Replicate to Couch, 2 docs should exist');
	
	addLocalDoc('wilma');
	addCouchDoc('fred', function() {
		replicateToCouch(function() {
			equal($tinycouch.replicator.changes.length, 0, '0 pending change should exist');
			start();
		});
	});
});

var replicateToCouch = function(callback) {
	
	ok($tinycouch.replicator.changes.length >= 1, 'At least 1 pending change should exist');

	$tinycouch.replicator.push($tinycouch.remote, function() {

		console.log('Replication push to couchDB complete');

		$couchdb.allDocs({
		 success: function (data) {
			ok(data.total_rows > 0, 'At least one document expected in CouchDB');
			if (callback) callback();
		 }
		});
	});
};

// Test
asyncTest("Replicate to localStorage, 2 docs should exist", 2, function() {

	console.log('# Replicate to localStorage, 2 docs should exist');
	
	addLocalDoc('wilma');
	addCouchDoc('fred', function() {
		replicateToLocal(function() {
			start();
		});
	});
});

var replicateToLocal = function(callback) {

	$tinycouch.replicator.pull($tinycouch.remote, function() {
	
		console.log('Replication pull to localStorage complete');
		if (callback) callback();
	});
};

// Test
asyncTest("Test adding, replicate to local, deleting local", 4, function() {
		
	console.log('# Test adding, replicate to local, deleting local');
	
	addLocalDoc('wilma');	
	addCouchDoc('fred', function() {
		
		replicateToLocal(function() {

			var records = $tinycouch.findAll();
			var fred = _.detect(records, function(o) {
				return o.name === 'fred';
			});
			start();
			ok(typeof(fred) === 'object', 'Fred has been found');

			$tinycouch.destroy(fred);
			$tinycouch.save();

			equal($tinycouch.findAll().length, 1, '1 docs should exist');		
		});
	});
});

// Test

asyncTest("Test adding to couch, replicate to local, deleting from couch and replicating again", 8, function() {
		
	console.log('# Test adding to couch, replicate to local, deleting from couch and replicating again');
	
	addLocalDoc('wilma');
	replicateToCouch(function() {
		
		var records = $tinycouch.findAll();
		var wilma = _.detect(records, function(o) {
			return o.get('name') === 'wilma';
		});

		ok(typeof(wilma) === 'object', 'Wilma has been found');
		ok(wilma.get('_rev') !== undefined, 'Wilma has an assigned revision');
		equal($tinycouch.findAll().length, 1, '1 docs should exist');

		$couchdb.removeDoc(wilma.toJSON(), {
			success: function() {

				ok(true, 'CouchDB doc successfully removed');

				replicateToLocal(function() {

					equal($tinycouch.findAll().length, 0, '0 docs should exist');

					start();
				});
			}, 
			error: function(xhr, bah, error) {
				ok(false, 'Unable to remove doc,' + error);
				start();
			}
		});
	});
});
