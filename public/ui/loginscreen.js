class LoginScreen extends Modal {
    constructor( loginManager ){
      	super("Login", null, null, null, true);
      	this.loginManager = loginManager;
      	this.inputField = new Input( "Username", false );
      	this.passwordField = new Input( "Password", true );
      	this.tokenField = new Input( "Token", true );
      	this.loginButton = 	new Button("Login");
      
      	this.body.addChild( this.inputField );
      	this.body.addChild( new Br() );
      	this.body.addChild( new Br() );
      	this.body.addChild( this.passwordField );
        this.body.addChild( new Br() );
      	this.body.addChild( new Br() );
      	this.body.addChild( this.tokenField );
      	
      	
      	this.tokenField.element.addEventListener("keyup", (event) => {
            event.preventDefault();
            if (event.keyCode == 13) {
                this.handleLogin();
            }
        });
        
        this.passwordField.element.addEventListener("keyup", (event) => {
            event.preventDefault();
            if (event.keyCode == 13) {
                
                this.handleLogin();
            }
        });
      
      	this.loginButton.element.addEventListener("click", (e) => this.handleLogin(e) );
      	this.footer.addChild( this.loginButton );
	}
  
  	handleLogin(){
      	this.loginManager.login(this.inputField.element.value, this.passwordField.element.value,  this.tokenField.element.value, (success) => {
          	if(success){
            	$(this.element).modal('hide');
            }
        });
    }
}
