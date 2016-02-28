var OauthHandler = React.createClass({
	getInitialState: function () {
		return {
			RedirectURL = "http://livemixr.azurewebsites.net/",
			ClientID = "106086389634-cril0dmoiidf7n0haq1ba2asef88bemr.apps.googleusercontent.com",
			CookiePolicy = "single_host_origin",
			RequestVisibleActions = "http://schema.org/AddAction",
			Scope = "https://www.googleapis.com/auth/plus.profile.emails.read"
		};
	},
	onLogin: function() {

	},
	render: function() {
		return (
			<button type="submit" onClick={this.onLogin}>Login</div>
		);
	}
});