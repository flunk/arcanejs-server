manifest = [
    "lib/ace/ace.js",
    "lib/ace/ext-language_tools.js",
    "lib/arcanejs-ui/css/elementjs.css",
    "lib/arcanejs-ui/css/bsoverride.css",    
  	"lib/morrisjs/morris.css",
  	"lib/morrisjs/raphael-min.js",  
    "lib/morrisjs/morris.min.js",
    "lib/arcanejs-ui/js/element.js",
    "lib/arcanejs-ui/js/dom/div.js",
    "lib/arcanejs-ui/js/dom/button.js",
    "lib/arcanejs-ui/js/dom/link.js",
    "lib/arcanejs-ui/js/dom/h1.js",
    "lib/arcanejs-ui/js/dom/h2.js",
    "lib/arcanejs-ui/js/dom/h3.js",
    "lib/arcanejs-ui/js/dom/paragraph.js",
    "lib/arcanejs-ui/js/dom/span.js",
    "lib/arcanejs-ui/js/dom/img.js",
    "lib/arcanejs-ui/js/dom/br.js",
    "lib/arcanejs-ui/js/dom/textarea.js",
    "lib/arcanejs-ui/js/dom/input.js",
    "lib/arcanejs-ui/js/dom/list.js",
    "lib/arcanejs-ui/js/dom/listitem.js",
    "lib/arcanejs-ui/js/bootstrap/navbar.js",
    "lib/arcanejs-ui/js/bootstrap/navbaritem.js",
    "lib/arcanejs-ui/js/bootstrap/navbarapp.js",
    "lib/arcanejs-ui/js/bootstrap/modal.js",
    "lib/arcanejs-ui/js/bootstrap/dropdown.js",
    "lib/arcanejs-ui/js/bootstrap/dropdownitem.js",
    "lib/arcanejs-ui/js/bootstrap/dropdownselect.js",
    "lib/arcanejs-ui/js/bootstrap/glyphicon.js",
  	"lib/arcanejs-ui/js/ui/baseapp.js",
    "lib/arcanejs-ui/js/ui/panel.js",
    "lib/arcanejs-ui/js/ui/frame.js",
    "lib/arcanejs-ui/js/ui/frameset.js",
    "lib/arcanejs-ui/js/ui/framehandle.js",
    "lib/arcanejs-ui/js/ui/view.js",
    "lib/arcanejs-ui/js/ui/tabgroup.js",
    "lib/arcanejs-ui/js/ui/panelTab.js",
    "lib/arcanejs-ui/js/ui/panelHandle.js",
    "lib/arcanejs-ui/js/ui/panelStack.js",
    "ui/loginscreen.js",
    "net/logoutmodal.js",
    "net/reqmanager.js",
    "net/sessionmanager.js",
    "net/socketmanager.js",
    "net/loader.js",
	"app.js"
];

filesIncluded = [];

String.prototype.endsWith = function (s) {
	return this.length >= s.length && this.substr(this.length - s.length) == s;
}

class LoadingBar{
  	constructor(){
    	let bar = document.createElement("div");
        bar.style.position = 'absolute';
        bar.style.left = '0px';
        bar.style.top = '0px';
        bar.style.width = '0%';
        bar.style.height = '4px';
        bar.style.background = '#2a9fd6';
      	bar.style.zIndex = Number.MAX_SAFE_INTEGER; //OVER 9000!!!!!
     	document.body.appendChild(bar);
      	this.width = 0;
      	this.bar = bar;
      	this.target = 80;
      
      	this.lastTime = new Date().getTime();
      	
    	window.requestAnimationFrame(() => {this.update()});	
     	return this; 
	}
  
  	done(){
    	this.target = 100; 
    }
  
  	update(){
      	let currentTime = new Date().getTime();
      	let deltaTime = currentTime - this.lastTime;
      
      
      	if(this.width < this.target){
        	if(this.target < 100){
              	this.width = this.width + (( this.target - this.width ) * (0.005 * deltaTime));
            } else {
            	this.width += 0.5 * deltaTime;
            }
          	
        }
     
      	this.bar.style.width = this.width + "%";
      	
      	if(this.width < 100){
          	this.lastTime = currentTime;
        	window.requestAnimationFrame(() => {this.update()});
        } else {
          	this.bar.style.transition = "opacity 0.5s linear";         
          	this.bar.style.opacity = 0;
          	setTimeout(() => { this.bar.remove() }, 500);
        }
    }
}

class Includer{
	constructor(manifest, callback, hideLoadingBar){

      	this.manifest = manifest;
      	this.total = manifest.length;
      	this.loaded = 0;
      	this.callback = callback;

       	if(hideLoadingBar != true){
        	this.loadingBar = new LoadingBar(); 	
        }
      	
      	this.load();
    	return this;
    }
  
  	load(){
        let src = this.manifest.shift();
      	let el = null;
        if(filesIncluded.indexOf(src) === -1){
          	if(src.endsWith(".js")){
            	el = document.createElement( 'script' );
            	el.setAttribute("data-presets", "es2017");
                el.onload = () => {
                    filesIncluded.push(src);
                    this.done();
                };
            	el.src = src;
              	document.head.appendChild( el );
            } else if(src.endsWith(".css")){
                el = document.createElement( 'link' );
                el.setAttribute("rel", "stylesheet");
                el.setAttribute("type", "text/css");
                el.onload = () => {
                    this.done();
                }; 
              	el.setAttribute("href", src);
              	document.head.appendChild( el );
            } else {
            	console.log("Unknown filetype: " + src);
              	if(this.callback){
                	this.callback(false); 
                }
            }            
        } else {
            this.done();
        }
    }

  	done(){
    	this.loaded++;
      	if(this.loaded == this.total){
          	if(this.loadingBar){
            	this.loadingBar.done();
            }
          	
          	if(this.callback){
            	this.callback(true); 
            }
        } else {
        	this.load(); 
        }
    }
}

class PackageLoader{
	constructor(manifest, callback, hideLoadingBar){
      	this.callback = callback;

       	if(hideLoadingBar !== true){
        	this.loadingBar = new LoadingBar(); 	
        }
        
        let filteredManifest = [];
        
        manifest.forEach((src)=>{
            if(filesIncluded.indexOf(src) === -1){
                filteredManifest.push(src);
            }
        });
        
        
        this.getPack(filteredManifest, (res)=>{
            let pack = JSON.parse(res.responseText);
            console.log(pack);
            let pacLocation = "/api/cache/pack/" + pack.hash;
            new Includer([pacLocation + ".css",pacLocation + ".js"], ()=>{
                if (this.loadingBar){
                    this.loadingBar.done();
                }

                if(callback){
                    callback();
                }
                
            }, true);
        });
        
    	return this;
    }
    
    getPack(manifest, callback){
        let Httpreq = new XMLHttpRequest();
        Httpreq.open("POST", "/api/cache/getpackhash" ,true);
        Httpreq.setRequestHeader("Content-Type", "application/json");
        
         Httpreq.onload = (e) => {
          if (Httpreq.readyState === 4) {
              callback(Httpreq);
          }
        };
      
        Httpreq.onerror = (e) => {
        	console.error(xhr.statusText);
          	callback(null);
        };     
      	Httpreq.send(JSON.stringify({manifest:manifest, timeStamp:0}));
    }
}

getURLParameterByName = function(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

include = function(manifest, callback, hideLoadingBar){
	if(getURLParameterByName("debug") == 1){
	    new Includer(manifest, callback, hideLoadingBar);
	} else {
	    new PackageLoader(manifest, callback, hideLoadingBar);
	}
}

document.body.onload = function(){
    include(manifest, () => {
       app = new App();
    }, true);
}
