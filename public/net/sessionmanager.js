class SessionManager{
	constructor( app ){
      	this.app = app;
      	this.reqManager = app.reqManager;
      	this.csrfToken = null;
    	return this; 
    }
  
  	reauth(){
        console.log("Attempting to reauthenticate...");
        this.reqManager.post("api/reauth", null, (request) => {
            if(request.status == 200){
                let resData = JSON.parse(request.responseText);
                this.csrfToken = resData.csrfToken;
                this.app.init();
            } else {
                new LoginScreen( this );
            }
        }, null, true);
    }
  
 	login( username, password, token, callback){
        this.reqManager.post("api/login", {user:username, pass:password, token:token}, (request) => {
            if(request.status == 200){
                let resData = JSON.parse( request.responseText );
                this.csrfToken = resData.csrfToken;
                this.app.init();
                callback( true );
            } else {
                callback ( false );
            }
        }, null, true);
    }
}
