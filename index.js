'use strict';
var storage = require('node-persist');
var bcrypt = require('bcryptjs');
var cookieParser = require('cookie-parser');
var uuid = require('node-uuid');
var readlineSync = require('readline-sync');
var fs = require('fs');
var express = require('express');
var qrcode = require('qrcode-terminal');
var speakeasy = require('speakeasy');
var resolve = require('path').resolve;
var app = express();
var bodyParser = require('body-parser');
var plugins = [];

app.use(express.static('public'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json({limit: '50mb'}));
app.use(cookieParser());

storage.initSync();

//User stuff
var users = storage.getItem('users');
app.sessions = storage.getItem('sessions');
var port = storage.getItem('port');
var rootDir = storage.getItem('rootDir');
var options = storage.getItem('options');



if (!port || !rootDir) {
    firstRun();
}
if (app.sessions == undefined) {
    app.sessions = {};
}

if (options.sessionTimeout) {
    setInterval(() => {
        let date = new Date();
        for (const [key, value] of Object.entries(app.sessions)) {
            if (!(value.lastUsed instanceof Date)) {
                value.lastUsed = new Date(value.lastUsed);
            }
            if (date - value.lastUsed > options.sessionTimeout * 1000) {
                delete app.sessions[key];
            }
        }
        storage.setItem('sessions', app.sessions);
    }, 5000);
}

// Authorization stuff
let authModuleConfig = storage.getItem('auth');
const AuthModule = require('./modules/auth')(authModuleConfig);
app.authModule = new AuthModule(options.twoFactorEnabled);

loadPlugins();

function loadPlugins() {
    var files = fs.readdirSync(__dirname + '/plugins');
    for (var i in files) {
        var name = __dirname + '/plugins/' + files[i];

        if (fs.statSync(name).isDirectory()) {
            var plugin = require('./plugins/' + files[i] + '/index.js')(express, app, io);
            console.log(plugin.name);
            plugins.push(plugin);
        }
    }
}

function firstRun() {
    console.log('ArcaneJS-Server is run for the first time. Some variables need to be set before ArcaneJS can start.');
    askAuthenticationMethod();
    addUserDialog();
    options = {};

    port = readlineSync.question('HTTP Port to use : ');
    storage.setItem('port', port);
    rootDir = readlineSync.question('Root directory : ');
    storage.setItem('rootDir', rootDir);

    options.twoFactorEnabled = askQuestion('Enable 2 Factor authentication? : ');
    options.sessionTimeout = readlineSync.question('Timeout session after? (seconds): ', {defaultInput: '1800'});
    options.host = readlineSync.question('Hostname to listen on: ');

    storage.setItem('options', options);
}

function askAuthenticationMethod() {
    console.log('Which authentication method do you want to use?');
    let backends = ['file', 'ldap'];
    let index = readlineSync.keyInSelect(backends, 'Which authentication backend do you want to use?');
    let authModuleName = backends[index];
    storage.setItem('auth', {'authModule': authModuleName});
}

function addUserDialog() {
    console.log('Adding a new user.');
    var user = readlineSync.question('Username : ');
    var pass1 = 'a';
    var pass2 = 'b';
    var i = 0;
    while (pass1 != pass2) {
        if (i > 0) {
            console.log('Passwords did not match :(');
        }

        pass1 = readlineSync.question('Password : ', {
            hideEchoBack: true // The typed text on screen is hidden by `*` (default).
        });
        pass2 = readlineSync.question('Confirm password : ', {
            hideEchoBack: true // The typed text on screen is hidden by `*` (default).
        });
        i++;
    }

    var secret = speakeasy.generateSecret();
    console.log('2FA QR :');
    qrcode.generate(secret.otpauth_url);
    addUser(user, pass1, secret.base32);
}

function askQuestion(question) {
    let done = false;
    let result = true;
    let answer = null;

    while (!done) {
        answer = readlineSync.question(question);
        if (['y', 'yes'].includes(answer.toLowerCase())) {
            done = true;
        } else if (['n', 'no'].includes(answer.toLowerCase())) {
            result = false;
            done = true;
        }
    }

    return result;
}



function addUser(name, pass, secret) {
    var user = {};
    user.name = name;
    user.hash = bcrypt.hashSync(pass, bcrypt.genSaltSync(10));
    user.secret = secret;
    if (users == undefined) {
        users = [];
    }
    users.push(user);
    storage.setItem('users', users);
    console.log('User ' + name + ' added.');
    return user;
}


//Session stuff
function newSession(username, roles) {
    var session = {};
    session.uuid = uuid.v4();
    session.csrfToken = uuid.v4();
    session.username = username;
    session.roles = roles;
    session.loggedIn = true;
    session.lastUsed = new Date();
    app.sessions[session.uuid] = session;
    console.log(session);
    storage.setItem('sessions', app.sessions);
    return session;
}

var checkSession = function (req, res, checkCsrf, callback) {
    if (app.sessions[req.cookies.sessionId] != null) {
        if (app.sessions[req.cookies.sessionId].loggedIn) {
            if (checkCsrf) {
                if (req.get('X-Csrf-Token') == app.sessions[req.cookies.sessionId].csrfToken) {
                    let session = app.sessions[req.cookies.sessionId];
                    session.lastUsed = new Date();
                    req.session = session;
                    res.session = session;
                    callback(session);
                } else {
                    res.statusCode = 401;
                    res.send('Incorrect CSRF Token');
                }
            } else {
                app.sessions[req.cookies.sessionId].lastUsed = new Date();
                callback(app.sessions[req.cookies.sessionId]);
            }

        } else {
            delete app.sessions[req.cookies.sessionId];
            res.statusCode = 401;
            res.send('Session logged out');
        }
    } else {
        res.statusCode = 401;
        res.send('Session unknown');
    }
};

app.checkSession = checkSession;

//API routes
app.get('/api/apps', function (req, res) {
    checkSession(req, res, true, function (session) {
        var names = [];
        var i = 0;
        while (i < plugins.length) {
            names.push(plugins[i].name);
            i++;
        }
        res.send(names); //TODO: Cache this
    });
});

app.get('/api/dir', function (req, res) {
    checkSession(req, res, true, function (session) {
        let fullPath = resolve(rootDir + req.query.cd);

        if (fullPath.startsWith(rootDir)) {
            console.log('Getdir ' + fullPath);
            res.sendFile(fullPath);
        } else {
            res.statusCode = 403;
            res.send('Forbidden');
        }
        res.send(getFiles(rootDir + req.query.cd));
    });
});

app.get('/api/file/:name', function (req, res) {
    checkSession(req, res, true, function (session) {
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
    checkSession(req, res, true, function (session) {
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
    checkSession(req, res, true, function (session) {
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
    checkSession(req, res, true, function (session) {
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
    checkSession(req, res, true, function (session) {
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

app.post('/api/reauth', function (req, res) {
    checkSession(req, res, false, function (session) {
        res.send({csrfToken: session.csrfToken});
    });
});

app.post('/api/login', async (req, res) => {
    let username = req.body.data.user;
    let password = req.body.data.pass;
    let token = req.body.data.token;
    try {
        username = await app.authModule.login(username, password, token);
        let roles = app.authModule.getRoles(username);
        console.log(username);
        let session = newSession(username, roles);
        res.cookie('sessionId', session.uuid, {httpOnly: true});
        res.send({csrfToken: session.csrfToken});    
    } catch (err) {
        res.statusCode = 401;
        res.send(err.message);
    }
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

//var server = app.listen(port);
var server = require('http').createServer(app);
var io = require('socket.io')(server);

// Websocket stuffs
io.use(function (socket, next) {
    //Check if the user is authenticated
    var sessionId = socket.request.headers.cookie.split('sessionId=')[1].split(';')[0];
    var csrfToken = socket.handshake.query.csrftoken;
    var session = app.sessions[sessionId];

    if (session != null) {
        if (session.csrfToken == csrfToken) {
            socket.session = session;
            return next();
        }
    }

    next(new Error('Authentication error'));
});

io.on('connection', function (socket) {
    console.log(socket.session.username + ' connected');

    var i = 0;
    while (i < plugins.length) {
        if (plugins[i].handleNewSocket) {
            plugins[i].handleNewSocket(socket);
        }
        i++;
    }

    socket.on('disconnect', function () {
        console.log(socket.session.username + 'disconnect');
    });
});

require('./inc/cache.js')(express, app, io, rootDir);
server.listen(port, options.host);
console.log('Started on port ' + port);
