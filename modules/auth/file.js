const storage = require('node-persist');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

const AUTH_ERR_MSG = 'Authentication failed.';
const TWO_FACTOR_ERR_MSG = 'Invalid 2FA Token';

class FileAuth {
    constructor(twoFactorEnabled) {
        this.users = storage.getItem('users');
        this.twoFactorEnabled = twoFactorEnabled;
    }


    login(username, password, token) {
        let user = this.getUser(username);
        this.checkPassword(user, password);
        this.check2fa(user, token);
        return user.name;
    }

    getUser(username) {
        for (let user of this.users) {
            if (user.name === username) {
                return user; 
            }
        }
        throw new Error(AUTH_ERR_MSG);
    }

    getRoles(username) {
        return this.getUser(username).roles;
    }

    checkPassword(user, password) {
        if (!bcrypt.compareSync(password, user.hash)) {
            throw new Error(AUTH_ERR_MSG);
        }
    }

    check2fa(user, token) {
        if (this.twoFactorEnabled) {
            if (!speakeasy.totp.verify({secret: user.secret, encoding: 'base32', token: token})) {
                throw new Error(TWO_FACTOR_ERR_MSG);
            }
        }
    }

}


module.exports = FileAuth;
