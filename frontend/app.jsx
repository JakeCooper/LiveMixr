var socket = io();

function addEvent(element, eventName, callback) {
    if (element.addEventListener) {
        element.addEventListener(eventName, callback, false);
    } else if (element.attachEvent) {
        element.attachEvent("on" + eventName, callback);
	} else {
		element["on" + type] = handler;
	}
}

function removeEvent(element, eventName, callback) {
    if (element.removeventListener) {
        element.removeEventListener(eventName, callback, false);
    } else if (element.detachEvent) {
        element.detachEvent("on" + eventName, callback);
    } else {
		element["on" + type] = null;
	}
}

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

				// Server will callback with an auth token used to connect to firebase securely
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
	                                <button className="btn-google" type="button" onClick={this.onLogin}>
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
        var node = ReactDOM.findDOMNode(this);
        
        this.shouldScrollBottom = node.scrollTop + node.offsetHeight === node.scrollHeight;
    },
    componentDidUpdate: function() {
        if (this.shouldScrollBottom) {
            var node = ReactDOM.findDOMNode(this);
            node.scrollTop = node.scrollHeight
        }
    },
    render: function () {
        var Comments = (<div>Loading comments...</div>);
        if (this.props.comments) {
            Comments = this.props.comments.map(function (comment, i) {
                return <Comment comment={comment} key={i}/>;
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
                    <div className="message-body">{this.props.comment.text}</div>
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
        var text = this.refs.text.value;
        if (text == "")
        	return;
        //var comment = {author: author, text: text};
        var submitButton = this.refs.submit;
        submitButton.setAttribute('disabled', 'disabled');
        this.props.submitComment(text, function (err) {
            that.refs.text.value = '';
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
        return {
        	items: [], 
        	searching: true, 
        	search: "*"
        }
    },
    componentDidMount: function() {
        SC.initialize({
            client_id: '562a196f46a9c2241f185373ee32d44a'
        });  

        this.getTracks(this);
    },
    handleChange: function(sel) {

        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.handleSubmit, 300);
    },
    handleSubmit: function (){
        if (this.state.searching)
        	return;

        clearTimeout(this.timeout);

        this.setState({ search: this.refs.searchtext.value}, function() {

        	this.getTracks(this);
        });
    },
    handleEnter: function(ev) {
    	if(ev.keyCode === 13)
    		this.handleSubmit();
    },
    getTracks: function(that) {
        this.setState({ searching: true});

        // find all sounds of buskers licensed under 'creative commons share alike'
        SC.get('/tracks', {
            q: this.state.search
        }).then(function(tracks) {
            that.setState({ items: tracks, searching: false });
        });
    },
    reset: function() {
        this.setState({items: [], searching: false});
    },
	render: function() {
        var tracks;
        var search = this.state.search;

        if (this.state.searching){
            tracks =
                <div className="search-info search-loading">
                    <i className="fa fa-spinner fa-pulse"/>
                </div>
        } else if (this.state.items !== undefined && this.state.items.length > 0) {
            tracks = this.state.items.map(function (track, i) {
                return (<BrowseItem track={track} owner={this} key={i}/>);
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
                            <div className="search-box">
                                <input type="text"
                                       ref="searchtext"
                                       className="form-control"
                                       onKeyDown={this.handleEnter}
                                       onChange={this.handleChange}
                                       placeholder="Search for a Song"
                                       maxLength="200"/>
                            </div>
                            <div className="search-button">
                                <button ref="submit" type="button" className="btn btn-primary" onClick={this.handleSubmit}>
                                    <i className='fa fa-search'></i>
                                </button>
                            </div>
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
	listenQueueChanges: function() {

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
				{this.state.queue.map(function(item, i) {
					return <QueueItem key={i}
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
			listeners: 0,
			title: "No song playing",
			artist: "Select one from the browser",
			cover: "/img/Album-Placeholder.svg",
			trackUrl: undefined,
			userUrl: undefined
		}
	},
	componentDidMount: function () {

        SC.initialize({
            client_id: '562a196f46a9c2241f185373ee32d44a'
        });

		this.queue = new Firebase('https://livemixr.firebaseio.com/queue/');
		this.player = undefined;
		this.promise = undefined;
		this.volume = 1.0;

		var that = this;

		socket.on('updateusercount', function(count) {
			that.setState({listeners: count});
		});

		// Request user count from server
		socket.emit('getusercount');

		// Called when server tells the client to play a song. Has the current seek time and full data of the song
		socket.on('playnextsong', function(seek, data) {

			that.setSong(seek, data);
		});

		// This requests the current song from the server
		socket.emit('getseektime');
	},

	// Volume is a floating point between 0.0 (muted) and 1.0 (full)
	onVolumeChanged: function(volume) {

		this.volume = volume;

		// TODO: The player might bug out when volume is set but the player is either a bad ptr or not actually playing a song; must investigate
		if(this.player !== undefined && this.player._isPlaying === true) {

			this.player.setVolume(this.volume);
		}
	},
	setSong: function(seektime, data) {

		// This sets the song info on the player bar
		this.setState({ title: data.title, artist: data.user.username, cover: data.artwork_url, trackUrl: data.permalink_url, userUrl: data.user.permalink_url });

		// If a song is currently playing, pause it to stop the playback for the next song
        if(this.player !== undefined) {

        	try{
        		this.player.pause();
        	}
        	catch(e){}
        }

        var that = this;

        // This promise can be used to chain functions on the player when needed
        this.promise = SC.stream('/tracks/' + data.id).then(function (player) {
            
            // Set the class instance to the new player
        	that.player = player;

        	player.on('play-start', function(ev) {

        		// The html5 player expects the currentTime to be in seconds; we lose accuracy here
        		// until a better way is figured out to change the song timing
        		player.controller._html5Audio.currentTime = seektime / 1000.0;
        	});

            player.play();

            return player;
        });
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
                            <a className="song" target="_blank" href={this.state.trackUrl || "#!"}>{this.state.title}</a>
                            <a className="artist-album" target="_blank" href={this.state.userUrl || "#!"}>{this.state.artist}</a>
                            <span>{this.state.listeners} { this.state.listeners > 1 ? 'listeners' : 'listener' } right now</span>
                            <VolumeComponent volumeEvent={this.onVolumeChanged}/>
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

		// ask server for updated skip count
		socket.emit('getskipcount');

		socket.on('updateskipcount', function(count) {
			that.setState({skippers: count});
		});
	},
	updateSkip: function(){

		socket.emit('skipsong', this.props.user.id);
	},
	render: function() {
		return (
			<span className="skip-button-container">
				<button className="btn btn-default" onClick={this.updateSkip}>{this.state.skippers} {this.state.skippers === 1 ? 'Skip' : 'Skips'}</button>
			</span>
		)
	}
});

var VolumeComponent = React.createClass({ 

	getInitialState: function() {
		return {
			showVolumeBar: false,
			isDragging: false,
			startPosition: 0,
			startOffset: 0,
			barLength: 120, // Length of the slider bar
			offset: 120, // Current offset to start out (max volume)
			currentVolume: 1.0,
			isMuted: false
		}
	},

	componentDidMount: function() {

		this.mouseX = 0;
		this.mouseY = 0;
		this.fallbackDrag = false;

		addEvent(window, 'dragstart', this.onDragStart);
		addEvent(window, 'drag', this.onDrag);
		addEvent(window, 'dragend', this.onDragEnd);
	},

	componentWillUnmount: function() {

		removeEvent(window, 'dragstart', this.onDragStart);
		removeEvent(window, 'ondrag', this.onDrag);
		removeEvent(window, 'ondragend', this.onDragEnd);

		if(this.fallbackDrag) {
			removeEvent(document, 'dragover', this.onDragOver);
		}
	},

	showVolumeBar: function() {

		this.setState({showVolumeBar: true});
	},

	hideVolumeBar: function() {
		this.setState({showVolumeBar: false});
	},

	doFallback: function() {

		this.fallbackDrag = true;
		addEvent(document, 'dragover', this.onDragOver);
	},

	onDragStart: function(ev, i) {

		if(this.refs === undefined || this.refs.cursor === undefined)
			return;

		// Check that the drag start event is targeting the curwsor
		if(ev.target.className !== this.refs.cursor.className)
			return;

		// Needed by firefox
		ev.dataTransfer.setData('text/plain', '');
		ev.dataTransfer.dropEffect = 'link';

		// To retrieve the length of the bar, if it is ever to be changed by a media query or other source
		// which we may want in the future
		//var length = parseInt(this.refs.inner.props.style.width); // Returns 120 currently

		this.setState({isDragging: true, startPosition: ev.clientX, startOffset: this.state.offset});
	},

	onDrag: function(ev, i) {

		// Check if we're receiving real values; if not, switch to using dragOver event for clientx/y
		if(ev.clientX === 0 && ev.clientY === 0) {
			this.doFallback();
		}

		if(!this.state.isDragging || (this.mouseX === 0 && this.fallbackDrag))
			return;

		// Get the change in X from the user dragging
		var deltaX = (this.fallbackDrag ? this.mouseX : ev.clientX) - this.state.startPosition;

		if(deltaX < -120)
			return;

		// Offset from the starting offset of the cursor when the drags began
		var diff = deltaX + this.state.startOffset;

		// Keep the cursor within range of 0 - bar length
		var newOffset = Math.min(Math.max(diff, 0), this.state.barLength);

		// The volume needs to be in a value from 0.0 to 1.0
		var volume = newOffset / this.state.barLength;

		this.setState({offset: newOffset, currentVolume: volume});

		this.updateVolume();		
	},

	onDragOver: function(ev, i) {

		ev.dataTransfer.dropEffect = 'default';

		this.mouseX = ev.clientX;
		this.mouseY = ev.clientY;
	},
	onDragEnd: function(ev, i) {

		this.setState({isDragging: false});
	},

	onToggleMute: function(ev) {

		// Only toggle if the actual button is clicked
		if(ev.target.className !== this.refs.button.className)
			return;

		var muted = !this.state.isMuted;

		// Use both methods to set state, as setState is asynchronous and when we use it in updateVolume(), it may not be set yet (race condition)
		this.state.isMuted = muted;
		this.setState({ isMuted: muted });

		this.updateVolume();
	},

	// This tells the player the current volume
	updateVolume: function() {

		this.props.volumeEvent(this.state.isMuted ? 0.0 : this.state.currentVolume);
	},

	render: function() {

		var innerStyle = {
			width: this.state.offset + 'px',
			cursor: 'default'
		};

		var cursorStyle = {
			// The bounds keep the cursor from going too far past the left or right extremum of the inner bar, to look good
			left: (Math.min(Math.max(this.state.offset, 4), this.state.barLength-6) - 6) + 'px',
			cursor: 'default'
		};

		return (
			<span className="volume-button" onClick={this.onToggleMute} onMouseEnter={this.showVolumeBar} onMouseLeave={this.hideVolumeBar}>
				<i ref="button" className={this.state.isMuted ? "fa fa-volume-off" : "fa fa-volume-up"}></i>
				{ this.state.showVolumeBar ? 
					<div className="volume-container">
						<div className="volume-bar">
							<div className="volume-slider">
								<div ref="inner" className="volume-inner" style={ innerStyle }></div>
								<span ref="cursor" className="volume-position" style={ cursorStyle } draggable="true"></span>
							</div>
						</div>
					</div>
					: false
				}
			</span>
		)
	}

});

ReactDOM.render(
	<MainPage/>,
	document.getElementById('main')
);