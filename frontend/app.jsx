var Oauth = React.createClass({
    getInitialState: function () {
        return {
            RedirectURL: "http://livemixr.azurewebsites.net/",
            ClientID: "870671781604-65ndlh54fkgpjsufkq2pmsn6rm3bvr8p.apps.googleusercontent.com",
            CookiePolicy: "single_host_origin",
            RequestVisibleActions: "http://schema.org/AddAction",
            Scope: "https://www.googleapis.com/auth/plus.profile.emails.read",
            ProfileName: null,
            ProfileImageUrl: null
        };
    },

    onLogin: function () {
        gapi.client.setApiKey("AIzaSyD4f3kc9MA9G4OU1z6zbeaGUOW5fjtt_5E");

        var SigninData = {
            'client_id': this.state.ClientID,
            'cookiepolicy': this.state.CookiePolicy,
            'requestvisibleactions': this.state.RequestVisibleActions,
            'scope': this.state.Scope
        };

        // lol good luck
        gapi.auth.authorize(
            SigninData,
            this.onAuthCallback
        );
    },
    onAuthCallback: function (AuthResult) {
        if (AuthResult && !AuthResult.error) {

            var that = this;

            this.loadProfileInfo(function () {

                React.render(
                    <CommentBox profileName={that.state.ProfileName} profileUrl={that.state.ProfileImageUrl}/>,
                    document.getElementById('content')
                );
            });

        } else {
            this.setState({content: "Auth Failed!"});
        }
    },
    loadProfileInfo: function (callback) {

        var that = this;

        gapi.client.load('plus', 'v1').then(function () {
            var request = gapi.client.plus.people.get({
                'userId': 'me'
            });

            request.then(function (resp) {

                that.state.ProfileName = resp.result.displayName;
                that.state.ProfileImageUrl = resp.result.image.url;

                callback();

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
                        <div className="login-header">
                            <h1>
                                Welcome to LiveMixr
                            </h1>
                        </div>
                        <div className="login-description">
                            LiveMixr makes music social. Joins tens of other users voting, talking and listening to the best music on the web.
                        </div>
                        <div className="login-auth">
                            <button className="login-google" type="submit" onClick={this.onLogin}>Login</button>
                        </div>
                    </div>
                </div>
            </div>
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
            that.setState({comments: comments});
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
    render: function () {
        return (
            <div className="commentBox">
                <h2>Hello {this.props.profileName}</h2>
                <img src={this.props.profileUrl}/>
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
                return (<Comment comment={comment}/>);
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
        var comment = {author: author, text: text};
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
                    <input type="text" name="author" ref="author" placeholder="Name" required/><br/>
                    <textarea name="text" ref="text" placeholder="Comment" required></textarea><br/>
                    <button type="submit" ref="submitButton">Post comment</button>
                </form>
            </div>
        );
    }
});

var Navbar = React.createClass({
    render: function () {
        return (
            <div className="navbar navbar-default navbar-fixed-top">
                <div className="container">
                    <div className="navbar-header">
                        <a href="#" className="navbar-brand">
                            <img src="img/LiveMixr-Logo.svg"/>
                        </a>
                    </div>

                    <div className="nav navbar-nav navbar-right">
                        {/* TODO: User Info */}
                    </div>
                </div>
            </div>
        )
    }
});

var MainPage = React.createClass({
    render: function () {
        return (
            <div>
                <Navbar/>
                <Oauth/>
            </div>
        )
    }
});

React.render(
    <MainPage/>,
    document.body
);