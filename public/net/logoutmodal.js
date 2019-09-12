class Logoutmodal extends Modal{
    constructor(){
        super(`Logged out`, null, null, null, true);
        this.body.setText(`You've been logged out. Please refresh the page and login again.`);
    }
}
