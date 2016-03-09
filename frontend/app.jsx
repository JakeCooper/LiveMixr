var socket = io();

var Oauth = React.createClass({
	getInitialState: function () {
		return {
			RedirectURL: "http://mixr.online/",
			ClientID: "870671781604-65ndlh54fkgpjsufkq2pmsn6rm3bvr8p.apps.googleusercontent.com",
			CookiePolicy: "single_host_origin",
			RequestVisibleActions: "http://schema.org/AddAction",
			Scope: "https://www.googleapis.com/auth/plus.profile.emails.read",
			ProfileName: null,
			ProfileImageUrl: null,
			ProfileId: null,
			TriedAuth: false,
			content: null
		};
	},
	componentDidMount: function () {
		gapi.client.setApiKey("AIzaSyD4f3kc9MA9G4OU1z6zbeaGUOW5fjtt_5E");

		// We try to auth as soon as page is loaded. If true, then we move past login page instantly
		// If not, then we wait for user to hit login and do the full page-by-page auth request
		this.SigninData = {
			'client_id': this.state.ClientID,
			'cookiepolicy': this.state.CookiePolicy,
			'requestvisibleactions': this.state.RequestVisibleActions,
			'scope': this.state.Scope,
			'immediate': true // Means we want to instantly know if user is authed or not
		};

		gapi.auth.authorize(
			this.SigninData,
			this.onAuthCallback
		);

	},
	getUserId: function() {

		return this.state.ProfileId;
	},
	onLogin: function() {

		this.SigninData.immediate = false;

		// lol good luck
		gapi.auth.authorize(
			this.SigninData,
			this.onAuthCallback
		);
	},
	onAuthCallback: function(AuthResult) {

		// This will signal to show the login bar after first auth attempt
		// If the first auth failed, then user will have to login
		this.setState({TriedAuth: true});

		if (AuthResult && !AuthResult.error) {

			var that = this;

			this.loadProfileInfo(function() {
				 that.props.setAuthStatus({ name: that.state.ProfileName, image: that.state.ProfileImageUrl,
				 							id: that.state.ProfileId });
			});

		} else {

			// TODO: What to do if auth fails?

			//this.setState({content:"Failed to login to Google+"});
		}
	},
	loadProfileInfo: function(callback) {

        var that = this;

        gapi.client.load('plus', 'v1').then(function () {
            var request = gapi.client.plus.people.get({
                'userId': 'me'
            });

            request.then(function (resp) {

				that.state.ProfileName = resp.result.displayName;
				that.state.ProfileImageUrl = resp.result.image.url;
				that.state.ProfileId = resp.result.id;

				socket.emit('login', that.state.ProfileId, function(success, authToken) {

					if(success === false) {
						console.log("Failed to generate authentication token!");
						return;
					}

					that.userdb = new Firebase('https://livemixr.firebaseio.com/users/' + that.state.ProfileId);

					// Authenticate with token received from server
					var promise = that.userdb.authWithCustomToken(authToken).then(function(data) {

						//if(error != null) {
						//	console.log(error);
						//	console.log("Failed to authenticate to firebase using token");
						//	return;
						//}

						// Load the user value
						that.userdb.once('value', function(user) {

							// See if this user has been persisted to the db. If not, save their data
							if(!user.hasChild("id")) {
								that.userdb.set({name: that.state.ProfileName, id: that.state.ProfileId, profile_url: that.state.ProfileImageUrl});
							}
						}, function(error) {
							console.log(error);
							console.log("Failed to read/update user in database; insufficient permissions?");
						});
				
						callback();
					});
				});

            }, function (reason) {
                console.log('Error: ' + reason.result.error.message);
            });
        });
    },
    render: function () {
        return (
            <div className="splash">
                <div className="container">
                    <div className="login-wrapper">
                    	<If test={this.state.TriedAuth}>
                    		<div>
	                            <div className="login-header">
	                                <h1>
	                                    Welcome to Mixr
	                                </h1>
	                            </div>
	                            <div className="login-description">
	                                <div>{this.state.content}</div>
	                                Mixr makes music social. Joins tens of other users voting, talking and listening to the
	                                best music on the web.
	                            </div>
	                            <div className="login-auth">
	                                <button className="btn-google" type="submit" onClick={this.onLogin}>
	                                    <i className="fa fa-google-plus"></i>
	                                    <div>
	                                        <small>Sign in with</small>
	                                        <br/>
	                                        <big>Google</big>
	                                    </div>
	                                </button>
	                            </div>
                            </div>
                        </If>
                        <If test={!this.state.TriedAuth}>
                            <div className="login-loading">
                                <i className="fa fa-spinner fa-pulse"></i>
                            </div>
                        </If>
                    </div>
                </div>
            </div>
        )
    }
});

var CommentBox = React.createClass({
	mixins: [ReactFireMixin],

	getInitialState: function () {
		return {
			comments: []
		};
	},
	componentDidMount: function () {

		this.commentdb = new Firebase('https://livemixr.firebaseio.com/comments');
		this.userdb = new Firebase('https://livemixr.firebaseio.com/users');

		var that = this;
		var first = true;

		this.commentdb.limitToLast(20).once("value", function(comments) {

			comments.forEach(function(comment) {

				var newComment = comment.val();

				that.userdb.child(newComment.author).once("value", function(user) {

					// Add to array of comments
					that.state.comments.push({author: user.val().name, text: newComment.text, image: user.val().profile_url, timestamp: newComment.timestamp });

					that.state.comments.sort(function(a,b) {
						return a.timestamp > b.timestamp;
					});

					// Set new comment state
					that.setState({comments: that.state.comments});
				});
			});
		});

		// Will pull the latest 5 messages, and then continue adding new messages
		this.commentdb.limitToLast(1).on("child_added", function(snapshot, prevKey) {

			if(first == true) {
				first = false;
				return;
			}
			var newComment = snapshot.val();
			var that = this;

			this.userdb.child(newComment.author).once("value", function(user) {

				// Add to array of comments 
				that.state.comments.push({author: user.val().name, text: newComment.text, image: user.val().profile_url, timestamp: newComment.timestamp });

				// Set new comment state
				that.setState({comments: that.state.comments});
			});

		}, function(){}, this);
	},
	submitComment: function (comment, callback) {

		// Sends new comment to the comment db
		this.commentdb.push({
			author: this.props.user.id,
			text: comment,
			timestamp: Firebase.ServerValue.TIMESTAMP
		});

		callback();
	},
	render: function() {
		return (
			<div>
				<CommentList comments={this.state.comments}/>
				<CommentForm submitComment={this.submitComment}/>
			</div>
		);
	}
});

var CommentList = React.createClass({
    componentWillUpdate: function() {
        var node = this.getDOMNode();
        this.shouldScrollBottom = node.scrollTop + node.offsetHeight === node.scrollHeight;
    },
    componentDidUpdate: function() {
        if (this.shouldScrollBottom) {
            var node = this.getDOMNode();
            node.scrollTop = node.scrollHeight
        }
    },
    render: function () {
        var Comments = (<div>Loading comments...</div>);
        if (this.props.comments) {
            Comments = this.props.comments.map(function (comment) {
                return (<Comment comment={comment}/>);
            });
        }
        return (
            <div className="message-list">
                {Comments}
            </div>
        );
    }
});
var Comment = React.createClass({
    render: function () {
        return (
            <div className="message">
                <div className="profile">
                    <img src={this.props.comment.image}/>
                </div>
                <div className="content">
                    <span className="author">{this.props.comment.author}</span>
                    <div className="body">{this.props.comment.text}</div>
                </div>
            </div>
        );
    }
});
var CommentForm = React.createClass({
    handleSubmit: function (e) {
        e.preventDefault();
        var that = this;
        //var author = this.refs.author.getDOMNode().value;
        var text = this.refs.text.getDOMNode().value;
        if (text == "") return;
        //var comment = {author: author, text: text};
        var submitButton = this.refs.submit.getDOMNode();
        submitButton.setAttribute('disabled', 'disabled');
        this.props.submitComment(text, function (err) {
            that.refs.text.getDOMNode().value = '';
            submitButton.removeAttribute('disabled');
        });
    },
    render: function () {
        return (
            <div className="message-form">
                <form onSubmit={this.handleSubmit}>
                    <div className="message-box">
                        <input type="text"
                               ref="text"
                               className="form-control"
                               placeholder="Send a Message"
                               maxLength="200"/>
                    </div>
                    <div className="message-button">
                        <button ref="submit" type="submit" className="btn btn-primary">
                            <i className='fa fa-paper-plane'></i>
                        </button>
                    </div>
                </form>
            </div>
        );
    }
});

var Navbar = React.createClass({
	getInitialState: function () {
		return {
		};
	},
	logout: function() {
		gapi.auth.signOut();
	},
	render: function () {
		return (
			<div className="navbar navbar-default navbar-fixed-top">
				<div className="container">
					<div className="navbar-header">
						<img className="navbar-brand" src="img/LiveMixr-Logo.svg"/>
					</div>
					<div className="navbar-title">
						<h1>Mixr</h1>
					</div>
					<div className="navbar-user">
						{(this.props.authed == true
								?
								<div>
									<img alt={this.props.user.name} src={this.props.user.image}/>
									<span className="name">{this.props.user.name}</span>
									<span className="name logout"><a href="#" onClick={this.logout}>Logout</a></span>
								</div>
							: false
						)}
					</div>
				</div>
			</div>
		)
	}
});

var If = React.createClass({
	render: function() {
		if (this.props.test) {
			return this.props.children;
		} else {
			return false;
		}
	}
});

var MainPage = React.createClass({
	getInitialState: function() {
		return {isAuthd: false, userParams: null}
	},
	setAuthStatus: function(inParams) {
		this.setState({userParams: inParams, isAuthd: true});
	},
	getAuthStatus: function() {
		return this.state.isAuthd === true;
	},
	render: function() {

		return (
			<div>
				<Navbar user={this.state.userParams} authed={this.state.isAuthd}/>
				<If test={!this.state.isAuthd}>
					<Oauth setAuthStatus={this.setAuthStatus}/>
				</If>
				<If test={this.state.isAuthd}>
					<Explore user={this.state.userParams} isAuthd={this.state.isAuthd}/>
				</If>
			</div>
		)
	}
});

var Explore = React.createClass({
	render: function() {
		return (
			<div className="container container-explore">
				<ChatPane user={this.props.user}/>
				<BrowsePane/>
				<QueuePane isAuthd={this.props.isAuthd}/>
				<PlayBar user={this.props.user}/>
			</div>
		)
	}
});

var ChatPane = React.createClass({
	render: function() {
		return (
			<div className="pane chat-pane">
				<CommentBox user={this.props.user}/>
			</div>
		)
	}
});

var BrowsePane = React.createClass({
    getInitialState: function() {
        return {items: [], searching: true, search: "*"}
    },
    componentWillMount: function (){
        this.getTracks(this);
    },
    handleChange: function(sel) {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.handleSubmit, 300);
    },
    handleSubmit: function (){
        if (this.state.searching) return;
        clearTimeout(this.timeout);
        this.setState({ search: this.refs.searchtext.getDOMNode().value});
        this.getTracks(this);
    },
    getTracks: function(that) {
        SC.initialize({
            client_id: '562a196f46a9c2241f185373ee32d44a'
        });

        this.setState({ searching: true});
        // find all sounds of buskers licensed under 'creative commons share alike'
        SC.get('/tracks', {
            q: this.state.search
        }).then(function(tracks) {
            that.setState({items: []});
            that.setState({ items: tracks, searching: false });
        });
    },
    reset: function() {
        this.setState({items: [], searching: false});
    },
    appendToQueue: function() {
        console.log("test");
    },
	render: function() {
        var tracks;
        var search = this.state.search;
        if (this.state.searching){
            tracks =
                <div className="search-info search-loading">
                    <i className="fa fa-spinner fa-pulse"/>
                </div>
        } else if (this.state.items !== undefined && this.state.items.length > 0){
            tracks = this.state.items.map(function (track, i) {
                return (<BrowseItem track={track} owner={this}/>);
            }.bind(this));
        } else {
            tracks =
                <div className="search-info search-error">
                    <h2>Uh oh.</h2>
                    <p>No songs found for <b>{search}</b>.</p>
                </div>
        }

		return (
            <div className="pane browse-pane container">
                <div className="row">
                    <div className="col-md-6">
                        <h1>Browse</h1>
                    </div>
                    <div className="search-form col-md-6">
                        <form onSubmit={this.handleSubmit}>
                            <div className="search-box">
                                <input type="text"
                                       ref="searchtext"
                                       className="form-control"
                                       onChange={this.handleChange}
                                       placeholder="Search for a Song"
                                       maxLength="200"/>
                            </div>
                            <div className="search-button">
                                <button ref="submit" type="submit" className="btn btn-primary">
                                    <i className='fa fa-search'></i>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                <div className="row">
                    <div className="col-lg-12">
                        {tracks}
                    </div>
                </div>
            </div>
		)
	}
});

var BrowseItem = React.createClass({
    getInitialState: function() {
        return {
        	added: false
        }
    },
    componentDidMount: function () {
    	this.queue = new Firebase('https://livemixr.firebaseio.com/queue/');
    },
    message: function(track) {

        // Adds the track ID to queue
        this.queue.push(
            {
                APIref: track.id,
                title: track.title,
                duration: track.duration,
                date: Firebase.ServerValue.TIMESTAMP,
                song: track
            }
        );
        this.setState({ added: true });
    },
    render: function() {
        var added = this.state.added;
        var desclen = 180;
        var track = this.props.track;
        var button = {
            icon: 'fa fa-' + (added ? 'check' : 'plus'),
            text: added ? 'Added to Queue' : 'Add to Queue',
            class: 'btn btn-default' + (added ? " disabled" : "")
        };
        return (
            <span>
			{((track && track.description !== undefined && track.description !== null && track.description.length) || false) ?
                <div className="browse-song">
                    <div className="album-art">
                        <img src={track.artwork_url || "/img/Album-Placeholder.svg"}/>
                    </div>
                    <div className="content">
                        <div className="info">
                            <div className="title">
                                <a href={track.permalink_url} target="_blank">
                                    {track.title}
                                </a>
                            </div>
                            <div className="user">
                                <a href={track.user.permalink_url} target="_blank">
                                    {track.user.username}
                                </a>
                            </div>
                            <div className="description">
                                {track.description.length < desclen ?
                                    track.description : track.description.slice(0, desclen) + "..."}
                            </div>
                            <div className="controls">
                                <button className={button.class} disabled={added}
                                        onClick={!added ? this.message.bind(this, track) : null}>
                                    <i className={button.icon}/> {button.text}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                : false}
			</span>
        )
    }
});

var QueuePane = React.createClass({
	getInitialState: function() {
     
		return {
			queue: []
		};
	},
	componentDidMount: function() {
		this.fireQueue = new Firebase('https://livemixr.firebaseio.com/queue/');

		this.listenQueueChanges();
	},
	listenQueueChanges: function(callback) {

		var that = this;

		this.fireQueue.on("value", function(payload) {
			var queue = [];
			payload.forEach(function(data){
				queue.push(data.val());
			});
			queue.sort(function(a,b) {
				return a.date > b.date;
			});
			that.setState({queue: queue})
		})
	},

	render: function() {
		return (
			<div className="pane queue-pane">
				{this.state.queue.map(function(item) {
					return <QueueItem key={item.APIref}
                                      song={item.song}
                                      APIref={item.APIref}/>
				})}
			</div>
		)
	}
});

var QueueItem = React.createClass({
	render: function() {
		return (
            <div className="queue-song panel panel-default">
                <div className="album-art">
                    <img src={this.props.song.artwork_url || "/img/Album-Placeholder.svg"}/>
                </div>
                <div className="content">
                    <div className="info">
                        <div className="title">
                            <a href={this.props.song.permalink_url} target="_blank">
                                {this.props.song.title}
                            </a>
                        </div>
                        <div className="user">
                            <a href={this.props.song.user.permalink_url} target="_blank">
                                {this.props.song.user.username}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        )
	}
});


var UserComponent = React.createClass({
	render: function() {
		return (
			<div>UserComponent</div>
		)
	}
});

var PlayBar = React.createClass({

	getInitialState: function() {
		return {
			listeners: 0
		}
	},
	componentDidMount: function () {

		this.queue = new Firebase('https://livemixr.firebaseio.com/queue/');

		var that = this;

		socket.on('updateusercount', function(count) {
			that.setState({listeners: count});
		});

		socket.emit('getusercount');

		socket.on('playnextsong', function(seek) {
			that.setSong(seek);
		});

		this.returnCurrentSong();

		socket.emit('getseektime');

        //this.setSong(0);

		return {title: null, artist:null,cover:"/img/Album-Placeholder.svg"}
	},

	setSong: function(seektime) {

        this.returnCurrentSong(function(data){
            SC.initialize({
                client_id: '562a196f46a9c2241f185373ee32d44a',
                redirect_uri: 'http://livemixr.azurewebsites.net/'
            });

            var player = SC.stream('/tracks/' + data.id).then(function (player) {
                player.seek(seektime);
                player.play();
            });
        });
	},

	muteSong: function() {
		player.setVolume(0);
	},

	unMuteSong: function() {
		player.setVolume(1);
	},

	voteUp: function() {
		console.log("fix this");
	},

	voteDown: function() {
		console.log("fix this too");
	},

	returnCurrentSong: function(callback) {
        callback = callback || function() {return false};
		
		var that = this;
		this.queue.on("value", function(payload) {
			var queued = [];
			payload.forEach(function(data){
				queued.push(data);
			});
			queued.sort(function(a,b){
				return a.date > b.date
			});

			// No song available in queue
			if(queued[0] == undefined)
				return;

			var request = new XMLHttpRequest();
			request.open('GET', 'https://api.soundcloud.com/tracks/' + queued[0].val()["APIref"] + '.json?client_id=562a196f46a9c2241f185373ee32d44a')
			request.onload = function() {
				if (request.status >= 200 && request.status < 400) {
					var data = JSON.parse(request.responseText);
					that.setState({title:data.title,artist:data.user.username,cover:data.artwork_url})
				    callback(data);
                } else {
					//handle failure from server
				}
			};

			request.onerror = function() {
				//connection problem
			};

			request.send();
		})
	},
	render: function() {
		return (
            <div className="playbar">
                <div className="song-progress">
                    <div className="song-progress-complete"></div>
                </div>
                <div className="content">
                    <img className="album-art" src={this.state.cover}/>
                    <div className="wrapper">
                        <div className="info">
                            <p className="song">{this.state.title}</p>
                            <p className="artist-album">{this.state.artist}</p>
                            <div>{this.state.listeners} users listening</div>
                            <CounterComponent user={this.props.user}/>
                        </div>
                    </div>
                </div>
            </div>
		)
	}
});

var CounterComponent = React.createClass({
	getInitialState: function() {
		return {
			skippers: 0
		}
	},
	componentDidMount: function () {

		var that = this;

		socket.on('updateskipcount', function(count) {
			that.setState({skippers: count});
		});
	},
	updateSkip: function(){
	//If the user has not tried to skip this song yet, increment his counter.

		socket.emit('skipsong', this.props.user.id);
	},
		render: function() {
		return (
			<span className="skip-button-container">
				<button className="btn btn-default skip" onClick={this.updateSkip}>{this.state.skippers} Skips</button>
			</span>
		)
	}
});

React.render(
	<MainPage/>,
	document.body
);