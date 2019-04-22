var backendShareDB = require("sharedb");
var http = require("http");
var connect = require("connect");
var WebSocket = require("ws");
var textType = require("ot-text");
var Duplex = require("stream").Duplex;
var regT = require("sharedb/lib/types");
//registering the text the document will be written in for tracking
regT.register(textType.type);
//server creation, static directory
var s = http.createServer(connect().use(connect['static'](__dirname + "/static")));
//client for websocket client streams
var client = new WebSocket.Server({server: s});
//listener for streams to synchronize states + reconnection
var backend = backendShareDB();
// handy tutorial on below client streams - https://github.com/josephg/ShareJS/wiki/Client-API
// Client streams connected
client.on("connection", function(newClient, req) {
  var stream = new Duplex({objectMode: true});
  stream.remoteAddress = newClient.upgradeReq.connection.remoteAddress;
  stream.headers = newClient.upgradeReq.headers;
  stream._write = function(operation, encoding, callbacks) {newClient.send(JSON.stringify(operation));callbacks();};
  stream._read = function() {};
  stream.on("error", function(msg) {newClient.close();});
  stream.on("end", function() {newClient.close();});
  newClient.on("message", function(operation) {stream.push(operation);});
  newClient.on("close", function() {stream.push(null);stream.emit("close");stream.emit("end");stream.end();
  });backend.listen(stream);
});
// temporary port number for localhost
var temporary = 8080;
//server listening at port 8080
s.listen(temporary, function() {return console.log("Currently Using = "+temporary);});
