// Written by Mike Frysinger <vapier@gmail.com>.  Released into the public domain.  Suck it.

/* Globals to allow easy manipulation via javascript console */
var mpc;
var tcpclient;
var refresh_id = NaN;

function TcpClientSender(tcpclient) {
	this.tcpclient = tcpclient;
}
TcpClientSender.prototype.send = function(data, cb) {
	this.tcpclient.sendMessage(data, cb);
}
TcpClientSender.prototype.poll = function() {
	this.tcpclient.poll();
}
TcpClientSender.prototype.reconnect = function() {
	this.tcpclient.disconnect();
	this.tcpclient.connect();
}

function tramp_mpc_recv(data) {
	mpc.recv(data);
}

function sync_storage(sync) {
	return sync ? chrome.storage.sync : chrome.storage.local;
}

window.onload = function() {
	var local_keys = [
		'sync',
	];
	var sync_keys = [
		'host', 'port', 'refresh',
	];
	var options = {
		'host': '192.168.0.2',
		'port': 6600,
		'sync': true,
		'refresh': 5,
	};

	chrome.storage.local.get(local_keys, function(settings) {
		local_keys.forEach(function(key) {
			if (key in settings)
				options[key] = settings[key]
		});

		var storage = sync_storage(options['sync']);
		storage.get(sync_keys, function(settings) {
			sync_keys.forEach(function(key) {
				if (key in settings)
					options[key] = settings[key];
			});

			init_ui(local_keys, sync_keys, options);
			mpc_connect();
		});
	});
};

window.onkeypress = function(e) {
	switch (e.keyCode) {
	case 49: // 1
		show_page('controls');
		break;
	case 50: // 1
		show_page('metadata');
		break;
	case 51: // 1
		show_page('playlist');
		break;
	case 52: // 1
		show_page('options');
		break;
	}
};

function mpc_refresh() {
	mpc.status();
}

function mpc_connect(host, port) {
	if (typeof(host) != 'string') {
		host = window['opts_host'].value;
		port = parseInt(window['opts_port'].value);
	}

	if (mpc != undefined) {
		console.log('disconnecting');
		update_ui('disconnect');
		delete mpc;
		tcpclient.disconnect();
		delete tcpclient;
	}

	update_ui('init');
	tcpclient = new TcpClient(host, port);
	tcpclient.connect(function() {
		var mpc_sender = new TcpClientSender(tcpclient);
		tcpclient.addResponseListener(tramp_mpc_recv);
		mpc = new Mpc(mpc_sender, update_ui);
		console.log('connected to ' + host + ':' + port);
		console.log('protip: use the "mpc" object to poke mpd directly.\n' +
		            'you can also do mpc.set_debug(3) to see traffic');
		mpc_refresh();
		update_refresh_timer();
	});
}

function tramp_mpc_consume() {
	var val = zo(!getToggleButton(this));
	mpc.consume(val);
	setToggleButton(this, val);
}
function tramp_mpc_deleteid() { mpc.deleteid(this.title); }
function tramp_mpc_next() { mpc.next(); }
function tramp_mpc_pause() { mpc.pause(); }
function tramp_mpc_play() { mpc.play(); }
function tramp_mpc_previous() { mpc.previous(); }
function tramp_mpc_random() {
	var val = zo(!getToggleButton(this));
	mpc.random(val);
	setToggleButton(this, val);
}
function tramp_mpc_repeat() {
	var val = zo(!getToggleButton(this));
	mpc.repeat(val);
	setToggleButton(this, val);
}
function tramp_mpc_seekcur() { mpc.seekcur(this.value); }
function tramp_mpc_setvol() { mpc.setvol(this.value); }
function tramp_mpc_single() {
	var val = zo(!getToggleButton(this));
	mpc.single(val);
	setToggleButton(this, val);
}
function tramp_mpc_stop() { mpc.stop(); }

function zo(val) {
	return val ? 1 : 0;
}
function szo(val) {
	return val == '0' ? 0 : 1;
}
function getToggleButton(btn) {
	return btn.style.borderStyle == 'inset';
}
function setToggleButton(btn, val) {
	if (val === undefined)
		val = !getToggleButton(btn);
	btn.style.borderStyle = val ? 'inset' : '';
}

function show_page(page) {
	if (typeof(page) != 'string')
		page = this.id.split('.')[1];

	// We might not be connected in which case 'mpc' will be undefined.
	switch (page) {
	case 'playlist':
		if (mpc)
			mpc.playlistinfo();
		// Fallthrough.
	case 'metadata':
		if (mpc)
			mpc.currentsong();
		break;
	}

	var eles = document.getElementsByClassName('main');
	for (var i = 0; i < eles.length; ++i) {
		var ele = eles[i];
		var dis = 'none';
		var cls = '';
		if (ele.id == 'main.' + page) {
			dis = '';
			cls = 'selected';
		}
		ele.style.display = dis;
		document.getElementById('tab.' + ele.id.split('.')[1]).className = cls;
	}
}

function do_refresh() {
	mpc_refresh();
	refresh_id = window.setTimeout(do_refresh, window['opts_refresh'].value * 1000);
}

function update_refresh_timer() {
	if (!isNaN(refresh_id))
		window.clearTimeout(refresh_id);
	var rate = window['opts_refresh'].value * 1000;
	if (rate > 0)
		refresh_id = window.setTimeout(do_refresh, rate);
}

function update_local_settings() {
	var setting = {};
	setting[this.id] = this.checked;
	chrome.storage.local.set(setting);
}

function update_sync_settings() {
	var setting = {};
	setting[this.id] = this.value;
	var storage = sync_storage(window['opts_sync'].checked);
	storage.set(setting);

	switch (this.id) {
	case 'refresh':
		update_refresh_timer();
		break;
	}
}

function init_ui(local_keys, sync_keys, options) {
	var ele, i;

	/* Setup footer */
	i = 1;
	[
		'controls', 'metadata', 'playlist', 'options',
	].forEach(function(id) {
		var ele = document.getElementById('tab.' + id);
		ele.onclick = show_page;
		ele.title = id + ' [' + i + ']';
		++i;
	});

	/* Setup control tab */
	ui_mpc_status = document.getElementById('status');
	[
		'consume', 'next', 'pause', 'play', 'previous', 'random', 'repeat',
		'seekcur', 'setvol', 'single', 'stop',
	].forEach(function(id) {
		var ele = window['ui_mpc_' + id] = document.getElementById(id);
		ele.onchange = ele.onclick = window['tramp_mpc_' + id];
		ele.title = id;
		if (ele.accessKey)
			ele.title += ' [' + ele.accessKey + ']'
	});
	window['ui_mpc_currtime'] = document.getElementById('currtime');

	/* Setup metadata tab */
	[
		'album', 'artist', 'date', 'file', 'title',
	].forEach(function(id) {
		window['ui_mpc_metadata_' + id] = document.getElementById('metadata.' + id);
	});

	/* Setup playlist tab */
	window['ui_mpc_playlist'] = document.getElementById('playlist');

	/* Setup options tab */
	document.getElementById('connect').onclick = mpc_connect;
	local_keys.forEach(function(id) {
		var ele = window['opts_' + id] = document.getElementById(id);
		ele.checked = options[id];
		ele.onchange = update_local_settings;
	});
	sync_keys.forEach(function(id) {
		var ele = window['opts_' + id] = document.getElementById(id);
		ele.value = options[id];
		ele.oninput = update_sync_settings;
	});
}

function pretty_time(time) {
	var sec, min, hrs, ret = '';
	time = parseInt(time);
	sec = time % 60;
	min = parseInt((time / 60) % 60);
	hrs = parseInt((time / 3600) % 3600);
	if (hrs)
		ret = hrs + ':' + ("00" + min).substr(-2) + ':';
	else
		ret = min + ':';
	return ret + ("00" + sec).substr(-2);
}

function playlist_del() {
	mpc.deleteid(this.song_id);
	this.parentNode.remove();
}

function playlist_play() {
	mpc.playid(this.song_id);
	this.parentNode.style.fontWeight = 'bold';
}

function update_ui(state, cmd) {
	if (typeof(state) == 'string') {
		ui_mpc_status.innerText = ({
			'disconnect': 'Disconnecting...',
			'init': 'Connecting...',
		})[state];
		return;
	}

	if (Array.isArray(state)) {
		/*
		switch (cmd[0]) {
		case 'setvol':
		case 'seekcur':
			break;
		default:
			mpc_refresh();
		}
		*/
		return;
	}

	/* Update the metadata tab only when things have changed. */
	var currentsong;
	if ('Currentsong' in state) {
		currentsong = state.Currentsong;
		if (ui_mpc_metadata_file.lastUpdate != state.Currentsong.lastUpdate) {
			ui_mpc_metadata_album.innerText = currentsong.Album;
			ui_mpc_metadata_artist.innerText = currentsong.Artist;
			ui_mpc_metadata_title.innerText = currentsong.Title;
			ui_mpc_metadata_date.innerText = currentsong.Date;
			ui_mpc_metadata_file.innerText = currentsong.file;
		}
	}

	/* Update the playlist tab only when things have changed. */
	if ('Playlist' in state && ui_mpc_playlist.lastUpdate != state.Playlist.lastUpdate) {
		var playlist = state.Playlist;

		ui_mpc_playlist.innerHTML = '';
		playlist.forEach(function(song) {
			var cell, row = ui_mpc_playlist.insertRow(-1);
			if (currentsong && song.Pos == currentsong.Pos)
				row.style.fontWeight = 'bold';

			cell = row.insertCell(-1);
			cell.id = 'playlist_del';
			cell.innerHTML = '&#164;';
			cell.song_id = song.Id;
			cell.title = 'delete';
			cell.onclick = playlist_del;

			cell = row.insertCell(-1);
			cell.innerText = song.Pos;
			cell.style.textAlign = 'right';
			cell.song_id = song.Id;
			cell.title = 'play';
			cell.onclick = playlist_play;

			if ('Artist' in song) {
				row.insertCell(-1).innerText = song.Artist;
				row.insertCell(-1).innerText = song.Album;
				row.insertCell(-1).innerText = song.Title;
			} else {
				cell = row.insertCell(-1);
				cell.innerText = song.file;
				cell.colSpan = 3;
			}
			row.insertCell(-1).innerText = pretty_time(song.Time);
		});

		ui_mpc_playlist.lastUpdate = playlist.lastUpdate;
	}

	/* Update the status tab. */
	var time, percent;
	if ('time' in state) {
		// When stopped, there is no time field at all.
		time = state.time.split(':');
		percent = Math.floor((0.0 + time[0]) * 100 / (0.0 + time[1]));
	} else {
		time = [0, 0];
		percent = 0;
	}
	ui_mpc_seekcur.max = time[1];
	ui_mpc_seekcur.value = time[0];
	ui_mpc_seekcur.title = 'seekcur (' + percent + '%)';
	ui_mpc_currtime.innerText = [pretty_time(time[0]), pretty_time(time[1]), percent + '%'].join(' / ');

	ui_mpc_setvol.title = 'setvol';
	if ('volume' in state) {
		ui_mpc_setvol.value = state.volume;
		ui_mpc_setvol.title += ' (' + state.volume + '%)';
	}

	[
		'consume', 'random', 'repeat', 'single',
	].forEach(function(id) {
		setToggleButton(window['ui_mpc_' + id], szo(state[id]));
	});

	ui_mpc_status.innerText = ({
		'play': 'Playing',
		'pause': 'Paused',
		'stop': 'Stopped',
	})[state.state];
}
