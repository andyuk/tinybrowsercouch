var db_name = 'tinybrowsercouch-tests';
var $couchdb;
var $tinycouch;

QUnit.begin = function() {

	// Remove all local storage
	delete localStorage[db_name];

	// drop (if exists) and create couch database
	$couchdb = $.couch.db(db_name);
	
	$.ajax({
		url: $couchdb.uri,
		type: 'GET',
		dataType: 'json',
	 	success: function (data) {
			console.log('Test DB exists');

			dropCouchDB(function() {
				createCouchDB();
			});
		 },
		 error: function(xhr, textStatus, error) {
			console.log('Test DB does not exist');
			createCouchDB();
		 }
	});

	$tinycouch = new TinyBrowserCouch.LocalStorage(db_name);
	$tinycouch.remote = new TinyBrowserCouch.CouchDB('/' + db_name + '/');
};

function createCouchDB() {
	
	$couchdb.create({
	 success: function (data) {
		console.log('Created CouchDB DB');
	 }
	});
}
function dropCouchDB(callback) {


	$couchdb.drop({
	 success: function (data) {
		console.log('Dropped CouchDB DB');	
		if (typeof(callback) === 'function') {
			callback();
		}
	 }
	});
}

QUnit.done = function(results) {
	
	// Remove all local storage
	delete localStorage[db_name];

	setTimeout(function() {
		dropCouchDB();
	}, 1000);
};

module("Main Tests");

asyncTest("Test connection", 1, function() {
	
	var test = function() {
	
		console.log('here');
		$couchdb.info({
		 success: function (data) {
			console.log('Got DB info OK');
			start();
			ok(true);
		 }
		});
	}
	
	// Delay start of this test until DB has been created in QUnit.begin
	setTimeout(test, 500);
});

asyncTest("Add CouchDB doc", 1, function() {
	
	var doc = {
		"name": "fred"
	};
	
	$couchdb.saveDoc(doc, {
	 success: function (data) {
		console.log('Saved ' + JSON.stringify(doc));
		start();
		ok(true);
	 }
	});
});

test("Add localStorage doc", 1, function() {
	
	var doc = new Backbone.Model({
		"name": "wilma"
	});
	
	$tinycouch.create(doc);
	$tinycouch.save();
	equal($tinycouch.findAll().length, 1, '1 doc found');
});

asyncTest("Replicate to Couch, 2 docs should exist", 1, function() {
	
	$tinycouch.replicator.push($tinycouch.remote, function() {
		
		start();
		console.log('Replication pull to couchDB complete');
		ok(true);
	});
});

test("Replicate to localStorage, 2 docs should exist", 1, function() {
	
	ok(true);
});

test("Remove local, replicate to couch, check it has been deleted", 1, function() {
	
	ok(true);
});

test("Remove couch, replicate to local, check it has been deleted", 1, function() {
	
	ok(true);
});

test("resolve conflict by picking Couch doc as winner", 1, function() {
	
	ok(true);
});
