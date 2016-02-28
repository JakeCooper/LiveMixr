var Oauth = React.createClass({
	getInitialState: function () {
		return {
			RedirectURL: "http://livemixr.azurewebsites.net/",
			ClientID: "870671781604-65ndlh54fkgpjsufkq2pmsn6rm3bvr8p.apps.googleusercontent.com",
			CookiePolicy: "single_host_origin",
			RequestVisibleActions: "http://schema.org/AddAction",
			Scope: "https://www.googleapis.com/auth/plus.profile.emails.read"
		};
	},
	onLogin: function() {
	console.log(this.state.ClientID);
	gapi.client.setApiKey("AIzaSyD4f3kc9MA9G4OU1z6zbeaGUOW5fjtt_5E");

		var SigninData = { 
			'client_id': this.state.ClientID,
			'cookiepolicy': this.state.CookiePolicy,
			'requestvisibleactions': this.state.RequestVisibleActions,
			'scope': this.state.Scope
		};

		// lol good luck
		gapi.auth.authorize( 
			SigninData
		);
	},
	render: function() {
		return (
				<button type="submit" onClick={this.onLogin}>Login</button>
			)
	}
});

var CommentBox = React.createClass({
	getInitialState: function () {
		return {
			comments: null
		};
	},
	componentDidMount: function () {
		var that = this;
		this.socket = io();
		this.socket.on('comments', function (comments) {
			that.setState({ comments: comments });
		});
		this.socket.emit('fetchComments');
	},
	submitComment: function (comment, callback) {
		this.socket.emit('newComment', comment, function (err) {
			if (err)
				return console.error('New comment error:', err);
			callback();
		});
	},
	render: function() {
		return (
			<div className="commentBox">
				<h3>Comments:</h3>
				<CommentList comments={this.state.comments}/>
				<CommentForm submitComment={this.submitComment}/>
			</div>
		);
	}
});

var CommentList = React.createClass({
	render: function () {
		var Comments = (<div>Loading comments...</div>);
		if (this.props.comments) {
			Comments = this.props.comments.map(function (comment) {
				return (<Comment comment={comment} />);
			});
		}
		return (
			<div className="commentList">
				{Comments}
			</div>
		);
	}
});
var Comment = React.createClass({
	render: function () {
		return (
			<div className="comment">
				<span className="author">{this.props.comment.author}</span> said:<br/>
				<div className="body">{this.props.comment.text}</div>
			</div>
		);
	}
});
var CommentForm = React.createClass({
	handleSubmit: function (e) {
		e.preventDefault();
		var that = this;
		var author = this.refs.author.getDOMNode().value;
		var text = this.refs.text.getDOMNode().value;
		var comment = { author: author, text: text };
		var submitButton = this.refs.submitButton.getDOMNode();
		submitButton.innerHTML = 'Posting comment...';
		submitButton.setAttribute('disabled', 'disabled');
		this.props.submitComment(comment, function (err) {
			that.refs.author.getDOMNode().value = '';
			that.refs.text.getDOMNode().value = '';
			submitButton.innerHTML = 'Post comment';
			submitButton.removeAttribute('disabled');
		});
	},
	render: function () {
		return (
			<div>
				<form className="commentForm" onSubmit={this.handleSubmit}>
					<input type="text" name="author" ref="author" placeholder="Name" required /><br/>
					<textarea name="text" ref="text" placeholder="Comment" required></textarea><br/>
					<button type="submit" ref="submitButton">Post comment</button>
				</form>
				<Oauth/>
			</div>
		);
	}
});

React.render(
	<CommentBox/>,
	document.getElementById('content')
);