class ReqManager{
  	constructor( app ){
		this.app = app;
      	return this;
    }
    
    get( url, callback ){
      	let loadingBar = new LoadingBar();
      	
        var Httpreq = new XMLHttpRequest();
        Httpreq.open("GET",url,true);
        Httpreq.setRequestHeader("X-Csrf-Token", this.app.sessionManager.csrfToken);

        Httpreq.onload = (e) => {
          if (Httpreq.readyState === 4) {
              loadingBar.done();
              if (Httpreq.status === 401) {
                  // We've been logged out...
                  new Logoutmodal();
              }
              else {
                  callback(Httpreq);
              }
          }
        };

        Httpreq.onerror = function (e) {
        	console.error(xhr.statusText);
          	
          	loadingBar.done();
          	callback(null);
        };
		Httpreq.send(null);
    }

    post( url , data, callback, hideLoadingbar, suppressLoggedOut){
        let loadingBar = null;
        if(hideLoadingbar === undefined){
            loadingBar = new LoadingBar();
        }
        
        let Httpreq = new XMLHttpRequest();
        Httpreq.open("POST", url ,true);
        Httpreq.setRequestHeader("X-Csrf-Token", this.app.sessionManager.csrfToken);
        Httpreq.setRequestHeader("Content-Type", "application/json");

         Httpreq.onload = (e) => {
          if (Httpreq.readyState === 4) {
              if(loadingBar){
                   loadingBar.done();
              }

              if (Httpreq.status === 401 && !suppressLoggedOut) {
                  // We've been logged out...
                  new Logoutmodal();
              }
              else {
                  callback(Httpreq);
              }
          }
        };
      
        Httpreq.onerror = (e) => {
        	console.error(xhr.statusText);
          	loadingBar.done();
          	callback(null);
        };     
      	Httpreq.send(JSON.stringify({data:data}));
    }

    delete( url, callback ){
        let loadingBar = new LoadingBar();

        var Httpreq = new XMLHttpRequest();
        Httpreq.open("DELETE",url,true);
        Httpreq.setRequestHeader("X-Csrf-Token", this.app.sessionManager.csrfToken);

        Httpreq.onload = (e) => {
            if (Httpreq.readyState === 4) {
                loadingBar.done();
                if (Httpreq.status === 401) {
                    // We've been logged out...
                    new Logoutmodal();
                }
                else {
                    callback(Httpreq);
                }
            }
        };

        Httpreq.onerror = function (e) {
            console.error(xhr.statusText);

            loadingBar.done();
            callback(null);
        };
        Httpreq.send(null);
    }
}
