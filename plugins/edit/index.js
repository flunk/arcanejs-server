module.exports = function ( express, app, io, rootDir ) {
  	edit = {};
  	edit.express = express;
  	edit.app = app;
  	edit.io = io;
  	edit.name = "edit";
  	edit.terminals = [];
    
    let os = require('os');
    let pty = require('node-pty');
    let fs = require('fs');
    var resolve = require('path').resolve;
      
  
  	app.use('/apps/edit', express.static(__dirname + '/public'));
  	
  	edit.handleNewSocket = ( socket ) => {
        socket.on('terminal attach', (id) => {
            let term = edit.terminals[id];
            if(term !== undefined){
                if(socket.session.username === term.username){
                    term.on('data', (data) => {
                        socket.emit("terminal data",{id:term.id, data:data});
                    });            
                }                
            }
        });
      
      	socket.on('terminal key', (data) => {
      	    let term = edit.terminals[data.id];
      	    if (term !== undefined && term.id !== -1) {
                term.write(data.key);
            }
        });
        
        socket.on('terminal resize', (data) => {
      	    let term = edit.terminals[data.id];
      	    if(term !== undefined && term.id !== -1){
      	        term.resize(data.cols, data.rows);
      	    }
          	
        });
        
        socket.on('terminal close', (data) => {
      	    console.log("Killing pty with id " + data.id);
      	    
      	    let term = edit.terminals[data.id];
            if(term !== undefined && term.id !== -1) {
                edit.terminals[data.id] = {id: -1};
                term.kill();
            }
        });
    };

    app.get('/api/dir', function (req, res) {
        app.checkSession(req, res, true, function (session) {
            let fullPath = resolve(rootDir + req.query.cd);

            if (fullPath.startsWith(rootDir)) {
                console.log('Getdir ' + fullPath);
                res.send(getFiles(fullPath));
            } else {
                res.statusCode = 403;
                res.send('Forbidden');
            }
        });
    });

    app.get('/api/file/:name', function (req, res) {
        app.checkSession(req, res, true, function (session) {
            let fullPath = resolve(rootDir + req.query.cd + req.params.name);

            if (fullPath.startsWith(rootDir)) {
                console.log('Getfile ' + fullPath);
                res.sendFile(fullPath);
            } else {
                res.statusCode = 403;
                res.send('Forbidden');
            }
        });
    });

    app.post('/api/save/:name', function (req, res) {
        app.checkSession(req, res, true, function (session) {
            let fullPath = resolve(rootDir + req.query.cd + req.params.name);

            if (fullPath.startsWith(rootDir)) {
                console.log('Saving ' + fullPath);
                fs.writeFile(fullPath, req.body.data, function (err, data) {
                    if (err) {
                        res.statusCode = 500;
                        res.send('Error saving');
                    } else {
                        io.sockets.emit('refresh', 'now');
                        res.send(true);
                    }
                });
            } else {
                res.statusCode = 403;
                res.send('Forbidden');
            }
        });
    });

    app.post('/api/newFile/:name', function (req, res) {
        app.checkSession(req, res, true, function (session) {
            let fullPath = resolve(rootDir + req.query.cd + req.params.name);
            if (fullPath.startsWith(rootDir)) {
                console.log('Creating New File ' + fullPath);
                fs.lstat(rootDir + req.query.cd + req.params.name, function (err, stats) {
                    if (err) {
                        fs.writeFile(fullPath, req.body.data, function (err, data) {
                            if (err) {
                                res.statusCode = 418;
                                res.send('Error creating file');
                            } else {
                                res.send(true);
                            }
                        });
                    } else {
                        res.statusCode = 409;
                        res.send('File exists!');
                    }
                });
            } else {
                res.statusCode = 403;
                res.send('Forbidden');
            }
        });
    });

    app.post('/api/newDir', function (req, res) {
        app.checkSession(req, res, true, function (session) {
            let fullPath = resolve(rootDir + req.query.cd);
            if (fullPath.startsWith(rootDir)) {
                console.log('Creating New Directory ' + fullPath);
                fs.lstat(rootDir + req.query.cd, function (err, stats) {
                    if (err) {
                        fs.mkdirSync(fullPath);
                        res.send(true);
                    } else {
                        res.statusCode = 409;
                        res.send('Directory exists!');
                    }
                });
            } else {
                res.statusCode = 403;
                res.send('Forbidden');
            }
        });
    });

    app.post('/api/delete', function (req, res) {
        app.checkSession(req, res, true, function (session) {
            let fullPath = resolve(rootDir + req.query.cd);

            if (fullPath.startsWith(rootDir)) {
                console.log('Deleting ' + fullPath);
                fs.lstat(fullPath, function (err, stats) {
                    if (!err) {
                        if (stats.isDirectory()) {
                            deleteFolderRecursive(fullPath);
                            res.send(true);
                        } else {
                            fs.unlinkSync(fullPath);
                            res.send(true);
                        }
                    } else {
                        res.statusCode = 404;
                        res.send('File doesn\'t exist!');
                    }
                });
            } else {
                res.statusCode = 403;
                res.send('Forbidden');
            }
        });
    });
    
    app.get('/api/edit/newterminal', (req, res) => {    
        app.checkSession(req, res, true, (session) => {
            let term = pty.spawn('bash', [], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: process.env.HOME,
                env: process.env
            });
            
            term.id = edit.terminals.length;
            term.username = session.username;
            edit.terminals.push(term);

            term.onExit(() => {
                let index = edit.terminals.indexOf(term);
                if (index !== false) {
                    edit.terminals[index] = {id:-1};
                }
            });
            
            console.log("Forking new pty with id " + term.id + " for " + term.username );
            res.send({id:term.id});
        });        
    });
    
    app.get('/api/edit/openterminals', (req, res) => {    
        app.checkSession(req, res, true, (session) => {
            let found = [];
            edit.terminals.forEach((terminal) => {
                if(terminal.username == session.username){
                    found.push(terminal.id);
                } 
            });

            res.send({found:found});
        });        
    });

    var getFiles = function (dir, files_) {
        files_ = [];
        dir = resolve(dir);

        if (dir.startsWith(rootDir)) {
            var files = fs.readdirSync(dir);
            for (var i in files) {
                var file = {name: files[i]};
                var name = dir + '/' + files[i];

                file.isDir = fs.statSync(name).isDirectory();

                files_.push(file);
            }
        }

        return files_;
    };

    var deleteFolderRecursive = function (path) {
        path = resolve(path);

        if (path.startsWith(rootDir)) {
            if (fs.existsSync(path)) {
                fs.readdirSync(path).forEach(function (file, index) {
                    var curPath = path + '/' + file;
                    if (fs.lstatSync(curPath).isDirectory()) { // recurse
                        deleteFolderRecursive(curPath);
                    } else { // delete file
                        fs.unlinkSync(curPath);
                    }
                });
                fs.rmdirSync(path);
            }
        }
    };
    
  	return edit;
}
