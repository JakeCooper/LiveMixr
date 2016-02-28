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

var skipRatio = 0.8; // 80% of skips required

var sessions = [];

var skippers = [];

var currentSong = undefined;
var songFinish = undefined;

var allSongs = [];

var songTimer = undefined;

var PlayNextSong = function() {

	if(songTimer != undefined)
		clearTimeout(songTimer);

	skippers = [];

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

	sessions.forEach(function(sess) {

		sess.emit("playnextsong");
	});

	songTimer = setTimeout(function() {

		PlayNextSong();

	}, 1000 * 60);
};

var RemoveSongByKey = function(key) {

	db.child("queue/" + key).remove();

	console.log("removed song " + key);
};

// queue bullshit

db.child("queue").on("child_added", function(key, prev) {


	// Add to queue

	var songKey = key.key();
	song = key.val();
	song.key = songKey;

	allSongs.push(song);

	// sort by timestamps
	allSongs.sort(function(a, b) {
		return a.date > b.date;
	});

	// if no song playing, play one
	if(currentSong == undefined) {

		// logic to play first song

		PlayNextSong();
	}
});


io.on('connection', function (socket) {

	console.log("connected user");

	sessions.push(socket);

	io.sockets.emit('updateusercount', sessions.length);

	console.log(sessions.length);

	var sendSkipCount = function() {

		io.sockets.emit('updateskipcount', skippers.length);
	};

	var checkSkipPossible = function() {

		if(skippers.length > sessions.length * skipRatio) {

			console.log("skipping song");

			PlayNextSong();

			sendSkipCount();
		}
	};

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

	socket.on('skipsong', function(user_id) {

		if(user_id == undefined)
			return;

		console.log("skippers " + user_id);

		// Make sure no duplicate skippers
		if(skippers.indexOf(user_id) == -1) {

			skippers.push(user_id);

			console.log("skippers: " + skippers.length);

			sendSkipCount();

			checkSkipPossible();
		}
	});

});