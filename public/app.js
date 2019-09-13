class App {
	constructor(){
      	this.navBarApp = null;
      	this.reqManager = new ReqManager( this );
      	this.socketManager = new SocketManager( this );
      	this.sessionManager = new SessionManager( this );
		this.loader = new Loader( this );
		this.reqManager.get('/api/appname', (req) => {
			document.title = req.responseText;
		});
      	this.sessionManager.reauth();
    }
  
  	init(){
    	if (this.navBarApp == null){
        	this.navBarApp = new NavBarApp( "ArcaneJS" );
          	this.socketManager.connect();

          	this.reqManager.get("api/apps", (req) => {
            	let apps = JSON.parse(req.responseText);
                let i = 0;
                while(i < apps.length){
                    this.loader.loadJs("apps/"+ apps[i] + "/app.js");
                    i++; 
                }          
            });
        }
    }
};
