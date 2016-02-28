var path = require('path');
var express = require('express');

var app = express();

var port = normalizePort(process.env.PORT || '8080');

var staticPath = path.resolve(__dirname, '/public');
app.use(express.static(staticPath));

var FrontendPath = __dirname + "/../frontend";
var StaticPath = __dirname + "/../static";

app.set('view engine', 'html');

app.listen(port, function() {
  console.log('New LiveMixr server on port ' + port);
});

app.get('/', function(req,res) {
	
	// For static files
	app.use(express.static(path.resolve(StaticPath)));

	// For dynamic js/css
	app.use(express.static(path.resolve(FrontendPath)));
	
	res.sendFile(path.resolve(__dirname + '/../frontend/index.html'))
})

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
