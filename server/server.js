var path = require('path');
var fs = require('fs');
var express = require('express');
var FirebaseTokenGenerator = require("firebase-token-generator");

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

var firebaseSecretKey;

// Read file to get Firebase secret key
try {
	firebaseSecretKey = fs.readFileSync('firebase.secret').toString();

	console.log("Using file 'firebase.secret' as source for firebase secret key");
}
catch(e) {

	// If file doesn't exist, try to use an environment variable
	if(process.env.FIREBASE_SECRET !== undefined) {

		firebaseSecretKey = process.env.FIREBASE_SECRET;

		console.log("Using environment variable as source for firebase secret key");
	}
	// Otherwise the server won't work until the secret key is added in some form
	else {

		throw "Firebase secret key is not available in the file 'firebase.secret' or as an environment variable";
	}	
}

var tokenGenerator = new FirebaseTokenGenerator(firebaseSecretKey);

var io = require('socket.io')(server);
var Firebase = require("firebase");

// This is the server side database connection
var db = new Firebase("https://livemixr.firebaseio.com/");

// Auth on server side is done directly with the secret key. This grants full read/write access
db.authWithCustomToken(firebaseSecretKey, function(error) {
	if(error != null) {
		console.log(error);
		throw "Error while authenticating to firebase. Secret key may be incorrect or expired";
	}

	console.log("Server is authenticated to firebase with secret key");
});


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

	socket.profile_id = 0;
	socket.authenticated = false;

	sessions.push(socket);

	io.sockets.emit('updateusercount', sessions.length);

	console.log("There are currently " + sessions.length + " connected users");

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

	socket.on('login', function(profile, callback) {

		socket.profile_id = profile;
		socket.authenticated = true;

		// TODO: Verify profile ID in firebase

		// TODO: For added security, this function should receive the current G+ auth token
		// that the user is logged in with, and make a G+ API call to actually verify the auth token is valid.
		// That way, the server can validate the logged in user making this login request is correctly authenticated to do so

		// A users G+ profile ID is what is used as the unique ID for this user to access the database from the client side
		var token = tokenGenerator.createToken({ uid: socket.profile_id });

		callback(true, token);
	});

	socket.on('disconnect', function() {

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