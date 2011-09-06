TinyBrowserCouch
================================

TinyBrowserCouch is a light wrapper around the HTML5 Web Storage API that includes replication capabilities with CouchDB.

The aim of this tiny library is not to provide CouchDB like capabilities in the browser, just to make it easy synchronising data between Web Storage and CouchDB.

If you want more advanced capabilities, check out PounchDB and BrowserCouch.

Related projects:
Browser Couch: http://hg.toolness.com/browser-couch/raw-file/blog-post/index.html
PouchDB: https://github.com/mikeal/pouchdb

# API

var bookStore = new TinyBrowserCouch.LocalStorage("myBooks");
var couchDB = new TinyBrowserCouch.CouchDB("http://localhost:3000/api/0.1/");

bookStore.replicator.pushTo(couchDB);
bookStore.replicator.pullFrom(couchDB);

# Known issues

* Replication currently only works well with a single CouchDB instance

# TODO

* Unit tests
* More sample code
