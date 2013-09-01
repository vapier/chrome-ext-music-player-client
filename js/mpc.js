// Written by Mike Frysinger <vapier@gmail.com>.  Released into the public domain.  Suck it.

function Mpc(socket, cb_update_state, debug_enabled) {
	this._socket = socket;
	this._cb_update_state = cb_update_state;
	this._debug_enabled = debug_enabled;
	this._queue = ['init'];
	this._recv_buffer = [];
	this._recv_buffer_last = 0;
	this.state = {};
}

Mpc.prototype.log = function(lvl, msg, obj) {
	if (this._debug_enabled & lvl)
		console.log('mpc: ' + msg, obj);
}

Mpc.prototype.err = function(msg, obj) {
	console.error('mpc: ' + msg, obj);
}

Mpc.prototype.set_debug = function(val) {
	this._debug_enabled = val;
}

Mpc.prototype.send = function(msg) {
	var _this = this;
	this._queue.push(msg);
	this._socket.send(msg, function(x) {
		_this.log(0x1, 'send: ' + msg + ':', x);
	});
}

Mpc.prototype.recv_msg = function(lines) {
	curr = this._queue.shift();
	this.log(0x2, 'recv: [' + curr + ']:', lines.join('\n'));
	curr = curr.split(' ');

	switch (curr[0]) {
	// Needs to return a list of dicts (see above for dicts).
	//case 'playlistinfo':
	case 'currentsong':
	case 'stats':
	case 'status':
		state = {};
		keys = [];
		lines.forEach(function(line) {
			i = line.indexOf(':');
			if (i == -1)
				return;	// Ignores the OK line
			key = line.substr(0, i);
			keys.push(key);
			val = line.substr(i + 2);
			state[key] = val;
		});

		// When mpd is stopped, it gives us back crap values for some things.
		if ('state' in state && state.state == 'stop') {
			if ('volume' in state && state.volume == '-1')
				keys.splice(keys.indexOf('volume'), 1);
		}
		// Now merge the current state with the previous one so that we don't
		// lose information like volume or song position.
		curr_state = this.state;
		keys.forEach(function(key) {
			curr_state[key] = state[key];
		});

		this._cb_update_state(curr_state);
		break;
	default:
		this._cb_update_state(lines, curr);
		break;
	}
}

Mpc.prototype.recv = function(msg) {
	/* We can get back a bunch of responses in a row, so parse them out */
	var lines = this._recv_buffer = this._recv_buffer.concat(msg.split('\n'));
	var i = 0;
	while (i < lines.length) {
		if (lines[i] == 'OK' || lines[i].substr(0, 3) == 'OK ') {
			this.recv_msg(lines.splice(0, i + 1));
			i = 0;
		} else
			++i;
	}

	if (lines.length && this._recv_buffer_last != lines.length) {
		// Keep sucking in data so long as more exists.
		this._recv_buffer_last = lines.length;
		this._socket.poll();
	} else
		this._recv_buffer_last = lines.length;
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
			this.err(cmd + ': function requires one argument');
		else
			this.send(cmd + ' ' + a1);
	}
}

Mpc.__make_send_arg2 = function(cmd) {
	return function(a1, a2) {
		if (a1 === undefined || a2 === undefined)
			this.err(cmd + ': function requires two arguments');
		else
			this.send(cmd + ' ' + a1 + ' ' + a2);
	}
}

Mpc.__make_send_arg3 = function(cmd) {
	return function(a1, a2, a3) {
		if (a1 === undefined || a2 === undefined || a3 == undefined)
			this.err(cmd + ': function requires three arguments');
		else
			this.send(cmd + ' ' + a1 + ' ' + a2 + ' ' + a3);
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
			this.err(cmd + ': arg must be [' + min + ',' + max + '] but got "' + arg + '"');
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
Mpc.prototype.crossfade           = Mpc.__make_send_arg1('crossfade');
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
 * The current playlist
 * http://www.musicpd.org/doc/protocol/ch03s04.html
 */

// add {URI}
Mpc.prototype.add                 = Mpc.__make_send_arg1('add');
// addid {URI} [POSITION]
// TODO: handle position
Mpc.prototype.addid               = Mpc.__make_send_arg1('addid');
// clear
Mpc.prototype.clear               = Mpc.__make_send_void('clear');
// delete [{POS} | {START:END}]
Mpc.prototype.delete              = Mpc.__make_send_arg1('delete');
// deleteid {SONGID}
Mpc.prototype.deleteid            = Mpc.__make_send_arg1('deleteid');
// move [{FROM} | {START:END}] {TO}
Mpc.prototype.move                = Mpc.__make_send_arg2('move');
// moveid {FROM} {TO}
Mpc.prototype.moveid              = Mpc.__make_send_arg2('moveid');
// playlist
Mpc.prototype.playlist            = Mpc.__make_send_void('playlist');
// playlistfind {TAG} {NEEDLE}
Mpc.prototype.playlistfind        = Mpc.__make_send_arg2('playlistfind');
// playlistid {SONGID}
Mpc.prototype.playlistid          = Mpc.__make_send_arg1('playlistid');
// playlistinfo [[SONGPOS] | [START:END]]
Mpc.prototype.playlistinfo        = Mpc.__make_send_opt('playlistinfo');
// playlistsearch {TAG} {NEEDLE}
Mpc.prototype.playlistsearch      = Mpc.__make_send_arg2('playlistsearch');
// plchanges {VERSION}
Mpc.prototype.plchanges           = Mpc.__make_send_arg1('plchanges');
// plchangesposid {VERSION}
Mpc.prototype.plchangesposid      = Mpc.__make_send_arg1('plchangesposid');
// prio {PRIORITY} {START:END...}
Mpc.prototype.prio                = Mpc.__make_send_arg2('prio');
// prioid {PRIORITY} {ID...}
Mpc.prototype.prioid              = Mpc.__make_send_arg2('prioid');
// shuffle [START:END]
Mpc.prototype.shuffle             = Mpc.__make_send_opt('shuffle');
// swap {SONG1} {SONG2}
Mpc.prototype.swap                = Mpc.__make_send_arg2('swap');
// swapid {SONG1} {SONG2}
Mpc.prototype.swapid              = Mpc.__make_send_arg2('swapid');

/*
 * Stored playlists
 * http://www.musicpd.org/doc/protocol/ch03s05.html
 */

// listplaylist {NAME}
Mpc.prototype.listplaylist        = Mpc.__make_send_arg1('listplaylist');
// listplaylistinfo {NAME}
Mpc.prototype.listplaylistinfo    = Mpc.__make_send_arg1('listplaylistinfo');
// listplaylists
Mpc.prototype.listplaylists       = Mpc.__make_send_void('listplaylists');
// load {NAME} [START:END]
// TODO: handle optional start:end
Mpc.prototype.load                = Mpc.__make_send_arg1('load');
// playlistadd {NAME} {URI}
Mpc.prototype.playlistadd         = Mpc.__make_send_arg2('playlistadd');
// playlistclear {NAME}
Mpc.prototype.playlistclear       = Mpc.__make_send_arg1('playlistclear');
// playlistdelete {NAME} {SONGPOS}
Mpc.prototype.playlistdelete      = Mpc.__make_send_arg2('playlistdelete');
// playlistmove {NAME} {SONGID} {SONGPOS}
Mpc.prototype.playlistmove        = Mpc.__make_send_arg3('playlistmove');
// rename {NAME} {NEW_NAME}
Mpc.prototype.rename              = Mpc.__make_send_arg2('rename');
// rm {NAME}
Mpc.prototype.rm                  = Mpc.__make_send_arg1('rm');
// save {NAME}
Mpc.prototype.save                = Mpc.__make_send_arg1('save');

/*
 * The music database
 * http://www.musicpd.org/doc/protocol/ch03s06.html
 */

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

/*
 * Audio output devices
 * http://www.musicpd.org/doc/protocol/ch03s09.html
 */

// disableoutput {ID}
Mpc.prototype.disableoutput       = Mpc.__make_send_arg1('disableoutput');
// enableoutput {ID}
Mpc.prototype.enableoutput        = Mpc.__make_send_arg1('enableoutput');
// outputs
Mpc.prototype.outputs             = Mpc.__make_send_void('outputs');

/*
 * Reflection
 * http://www.musicpd.org/doc/protocol/ch03s10.html
 */

// config
Mpc.prototype.config              = Mpc.__make_send_void('config');
// commands
Mpc.prototype.commands            = Mpc.__make_send_void('commands');
// notcommands
Mpc.prototype.notcommands         = Mpc.__make_send_void('notcommands');
// tagtypes
Mpc.prototype.tagtypes            = Mpc.__make_send_void('tagtypes');
// urlhandlers
Mpc.prototype.urlhandlers         = Mpc.__make_send_void('urlhandlers');
// decoders
Mpc.prototype.decoders            = Mpc.__make_send_void('decoders');

/*
 * Client to client
 * http://www.musicpd.org/doc/protocol/ch03s11.html
 */

// subscribe {NAME}
Mpc.prototype.subscribe           = Mpc.__make_send_arg1('subscribe');
// unsubscribe {NAME}
Mpc.prototype.unsubscribe         = Mpc.__make_send_arg1('unsubscribe');
// channels
Mpc.prototype.channels            = Mpc.__make_send_void('channels');
// readmessages
Mpc.prototype.readmessages        = Mpc.__make_send_void('readmessages');
// sendmessage {CHANNEL} {TEXT}
Mpc.prototype.sendmessage         = Mpc.__make_send_arg2('sendmessage');
