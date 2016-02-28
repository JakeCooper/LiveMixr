var path = require('path');
var fs = require('fs');
var express = require('express');

// Server part
var app = express();
app.use('/', express.static(path.join(__dirname, '../frontend')));

app.get('/testing', function(req,res) {
	res.send("BONK")
});

var port = normalizePort(process.env.PORT || '4000');

var server = app.listen(port);

server.on('error', onError);

function onError(error) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	var bind = typeof port === 'string'
		? 'Pipe ' + port
		: 'Port ' + port

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}

function normalizePort(val) {
	var port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

console.log('Server listening on port ' + port);

// Socket.IO part
var io = require('socket.io')(server);
var Firebase = require("firebase");

var db = new Firebase("https://saqaf086r05.firebaseio-demo.com");

var sessions = [];

io.on('connection', function (socket) {

	console.log("connected user");

	sessions.push(socket);

	io.sockets.emit('updateusercount', sessions.length);

	console.log(sessions.length);

	socket.on('disconnect', function(){

		console.log("disconnected user");

		// Remove from 
		sessions.splice( sessions.indexOf(socket), 1);

		io.sockets.emit('updateusercount', sessions.length);

		console.log(sessions.length);
	});

	socket.on('getusercount', function() {

		socket.emit('updateusercount', sessions.length);
	});
});

var currentSong = undefined;
var songFinish = undefined;

var allSongs = [];

var PlayNextSong = function() {

	if(allSongs.length == 0) {

		currentSong = undefined;
		songFinish = undefined;
		console.log("no more songs left");
		return;
	}

	// remove from queue and grab next one
	song = allSongs.shift();

	currentSong = song.APIref;
	songFinish = Date.now() + 1000 * 60;

	RemoveSongByKey(song.key);

	console.log("playing song " + currentSong);

	setTimeout(function() {

		PlayNextSong();

	}, 1000 * 60);
};

var RemoveSongByKey = function(key) {

	db.child("queue/" + key).remove();

	console.log("removed song " + key);
};

// queue bullshit

db.child("queue").on("child_added", function(key, prev) {

	//console.log(key.val());

	var songKey = key.key();
	song = key.val();
	song.key = songKey;

	allSongs.push(song);

	allSongs.sort(function(a, b) {
		return a.date > b.date;
	});

	if(currentSong == undefined) {

		// logic to play first song

		PlayNextSong();
	}
});