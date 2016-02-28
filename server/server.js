var path = require('path');
var fs = require('fs');
var express = require('express');

// Server part
var app = express();
app.use('/', express.static(path.join(__dirname, '../frontend')));

app.get('/testing', function(req,res) {

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

var sendComments = function (socket) {
	fs.readFile(path.resolve(__dirname + '/../_comments.json'), 'utf8', function(err, comments) {
		comments = JSON.parse(comments);
		socket.emit('comments', comments);
	});
};

io.on('connection', function (socket) {
  console.log('New client connected!');
  
  socket.on('fetchComments', function () {
		sendComments(socket);
	});

	socket.on('newComment', function (comment, callback) {
		fs.readFile('_comments.json', 'utf8', function(err, comments) {
			comments = JSON.parse(comments);
			comments.push(comment);
			fs.writeFile('_comments.json', JSON.stringify(comments, null, 4), function (err) {
				io.emit('comments', comments);
				callback(err);
			});
		});
	});
});