var path = require('path');
var express = require('express');

var app = express();

var port = normalizePort(process.env.PORT || '8080');

var staticPath = path.resolve(__dirname, '/public');
app.use(express.static(staticPath));

app.listen(port, function() {
  console.log('New LiveMixr server on port ' + port);
});

app.get('/', function(req,res) {
	res.send("Hello World")
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
