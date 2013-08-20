// Written by Mike Frysinger <vapier@gmail.com>.  Released into the public domain.  Suck it.

function Mpc(socket, cb_update_state) {
	this._socket = socket;
	this._cb_update_state = cb_update_state;
	this._queue = ['init'];
	this.state = {};
}

Mpc.log = function(msg, obj) {
	console.log('mpc: ' + msg, obj);
}

Mpc.prototype.send = function(msg) {
	this._queue.push(msg);
	this._socket.send(msg, function(x) {
		Mpc.log('send: ' + msg + ':', x);
	});
}

Mpc.prototype.recv_msg = function(lines) {
	curr = this._queue.shift();
	Mpc.log('recv: [' + curr + ']:', lines.join('\n'));
	curr = curr.split(' ');

	switch (curr[0]) {
	// Needs to return a list of dicts (see above for dicts).
	//case 'playlistinfo':
	case 'currentsong':
	case 'stats':
	case 'status':
		state = {};
		lines.forEach(function(line) {
			i = line.indexOf(':');
			if (i == -1)
				return;	// Ignores the OK line
			key = line.substr(0, i);
			val = line.substr(i + 2);
			state[key] = val;
		});
		this.state = state;
		this._cb_update_state(state);
		break;
	default:
		this._cb_update_state(lines, curr);
		break;
	}
}

Mpc.prototype.recv = function(msg) {
	/* We can get back a bunch of responses in a row, so parse them out */
	/* XXX: Do we have to handle partial reads ?  like long playlists ... */
	lines = msg.split('\n');
	var i = 0;
	while (i < lines.length) {
		if (lines[i] == 'OK' || lines[i].substr(0, 3) == 'OK ') {
			this.recv_msg(lines.splice(0, i + 1));
			i = 0;
		} else
			++i;
	}
}

/*
 * Command generator helpers.
 */

Mpc.__make_send_void = function(cmd) {
	return function() { this.send(cmd); }
}

Mpc.__make_send_arg1 = function(cmd) {
	return function(a1) {
		if (a1 === undefined)
			Mpc.log(cmd + ': function requires one argument');
		else
			this.send(cmd + ' ' + a1);
	}
}

Mpc.__make_send_arg2 = function(cmd) {
	return function(a1, a2) {
		if (a1 === undefined || a2 === undefined)
			Mpc.log(cmd + ': function requires two arguments');
		else
			this.send(cmd + ' ' + a1 + ' ' + a2);
	}
}

Mpc.__make_send_opt = function(cmd) {
	return function(arg) {
		if (arg === undefined)
			arg = '';
		this.send(cmd + ' ' + arg);
	};
}

Mpc.__make_send_range = function(cmd, min, max, def) {
	return function(arg) {
		if (arg === undefined)
			arg = def;
		if (arg >= min && arg <= max)
			this.send(cmd + ' ' + arg);
		else
			Mpc.log(cmd + ': arg must be [' + min + ',' + max + '] but got "' + arg + '"');
	};
}

/*
 * Querying MPD's status
 * http://www.musicpd.org/doc/protocol/ch03.html#idp118752
 */

// clearerror
Mpc.prototype.clearerror          = Mpc.__make_send_void('clearerror');
// currentsong
Mpc.prototype.currentsong         = Mpc.__make_send_void('currentsong');
// idle [SUBSYSTEMS...]
// TODO
// status
Mpc.prototype.status              = Mpc.__make_send_void('status');
// stats
Mpc.prototype.stats               = Mpc.__make_send_void('stats');

/*
 * Playback options
 * http://www.musicpd.org/doc/protocol/ch03s02.html
 */

// consume {STATE}
Mpc.prototype.consume             = Mpc.__make_send_range('consume', 0, 1, 1);
// crossfade {SECONDS}
Mpc.prototype.consume             = Mpc.__make_send_arg1('crossfade');
// mixrampdb {deciBels}
Mpc.prototype.mixrampdb           = Mpc.__make_send_arg1('mixrampdb');
// mixrampdelay {SECONDS|nan}
// Note: Probably should handle javascript NaN here.
Mpc.prototype.mixrampdelay        = Mpc.__make_send_arg1('mixrampdelay');
// random {STATE}
Mpc.prototype.random              = Mpc.__make_send_range('random', 0, 1, 1);
// repeat {STATE}
Mpc.prototype.repeat              = Mpc.__make_send_range('repeat', 0, 1, 1);
// setvol {VOL}
Mpc.prototype.setvol              = Mpc.__make_send_range('setvol', 0, 100);
// single {STATE}
Mpc.prototype.single              = Mpc.__make_send_range('single', 0, 1, 1);
// replay_gain_mode {MODE}
Mpc.prototype.replay_gain_mode    = Mpc.__make_send_arg1('replay_gain_mode');
// replay_gain_status

/*
 * Controlling playback
 * http://www.musicpd.org/doc/protocol/ch03s03.html
 */

// next
Mpc.prototype.next                = Mpc.__make_send_void('next');
// pause {PAUSE}
Mpc.prototype.pause               = Mpc.__make_send_range('pause', 0, 1, 1);
// play [SONGPOS]
Mpc.prototype.play                = Mpc.__make_send_opt('play');
// playid [SONGID]
Mpc.prototype.playid              = Mpc.__make_send_opt('playid');
// previous
Mpc.prototype.previous            = Mpc.__make_send_void('previous');
// seek {SONGPOS} {TIME}
Mpc.prototype.seek                = Mpc.__make_send_arg2('seek');
// seekid {SONGID} {TIME}
Mpc.prototype.seekid              = Mpc.__make_send_arg2('seekid');
// seekcur {TIME}
Mpc.prototype.seekcur             = Mpc.__make_send_arg1('seek');
// stop
Mpc.prototype.stop                = Mpc.__make_send_void('stop');

/*
 * Connection settings
 * http://www.musicpd.org/doc/protocol/ch03s08.html
 */

// close
Mpc.prototype.close               = Mpc.__make_send_void('close');
// kill
Mpc.prototype.kill                = Mpc.__make_send_void('kill');
// password {PASSWORD}
Mpc.prototype.password            = Mpc.__make_send_arg1('password');
// ping
Mpc.prototype.ping                = Mpc.__make_send_void('ping');
