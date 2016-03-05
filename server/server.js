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
var songStart = undefined;

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
	var song = allSongs.shift();

	currentSong = song.APIref;
	songStart = (new Date).getTime();
	songFinish = songStart + (song.duration != undefined ? song.duration : 1000 * 60);

	console.log("finish " + songFinish);

	RemoveSongByKey(song.key);

	console.log("playing song " + currentSong);

	sessions.forEach(function(sess) {

		sess.emit("playnextsong", 0);
	});
	;
	songTimer = setTimeout(function() {

		PlayNextSong();

	}, song.duration);
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

	socket.profile_id = 0;
	socket.authenticated = false;

	sessions.push(socket);

	io.sockets.emit('updateusercount', sessions.length);

	console.log(sessions.length);

	var getUniqueListeners = function() {

		var listeners = [];

		// Get number of unique listeners
		for (var i = 0; i < sessions.length; i++) {

			if (sessions[i].authenticated && sessions[i].profile_id
			   && listeners.indexOf(sessions[i].profile_id) == -1)
				listeners.push(sessions[i].profile_id);
		}

		return listeners.length;
	};

	var sendSkipCount = function() {

		io.sockets.emit('updateskipcount', skippers.length);
	};

	var checkSkipPossible = function() {

		var uniques = getUniqueListeners();

		console.log(sessions.length + " total listeners and " + skippers.length + " skippers but " + uniques + " are unique (needed skips)");

		if (skippers.length >= uniques * skipRatio) {

			console.log("skipping song");

			PlayNextSong();

			sendSkipCount();
		}
	};

	socket.on('login', function(profile) {

		socket.profile_id = profile;
		socket.authenticated = true;

		// TODO: Verify profile ID in firebase
	});

	socket.on('disconnect', function(){

		console.log("disconnected user");

		var idx = sessions.indexOf(socket);

		if(idx === -1)
			return;

		sessions.splice(idx, 1);

		io.sockets.emit('updateusercount', sessions.length);

		console.log(sessions.length);
	});

	socket.on('getusercount', function() {

		socket.emit('updateusercount', sessions.length);
	});

	socket.on('skipsong', function() {

		if(socket.authenticated === false)
			return;

		console.log("skippers " + socket.profile_id);

		// Make sure no duplicate skippers
		if(skippers.indexOf(socket.profile_id) == -1) {

			skippers.push(socket.profile_id);

			console.log("skippers: " + skippers.length);

			sendSkipCount();

			checkSkipPossible();
		}
	});

	socket.on('getseektime', function() {

		if(songFinish != undefined)
			socket.emit("playnextsong", (new Date).getTime() - songStart);
		else
			socket.emit("playnextsong", 0);
	});

});