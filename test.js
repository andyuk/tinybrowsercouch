
$(function() {
	
	var local_store = new TinyBrowserCouch.LocalStorage("vocab-list");
	var couchdb = new TinyBrowserCouch.CouchDB("/api/0.1/");
	
	listCouchData(couchdb);
	listLocalStorage(couchdb);
	
	$('#replicate-couch2local-btn').click(function() { 
		local_store.replicator.pull(couchdb, function() {
			
			console.log('Replication pull complete');
		});
	});
	$('#replicate-local2couch-btn').click(function() { 
		local_store.replicator.push(couchdb, function() {
			
			console.log('Replication push complete');
		});
	});
});

function listCouchData(couchdb) {
	
	$.getJSON(couchdb.url + '_changes', function(data) {
		
		$('#couchdb').val(JSON.stringify(data));
	});
}

function listLocalStorage(local_store) {
	
	if (local_store != undefined) {
		
		$('#web-storage').val(JSON.stringify(local_store.data));
	}
}
