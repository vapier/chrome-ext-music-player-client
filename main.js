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

function mpc_refresh() {
	mpc.status();
	mpc.currentsong();
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
		mpc_refresh();
		update_refresh_timer();
	});
}

function tramp_mpc_consume() {
	var val = zo(!getToggleButton(this));
	mpc.consume(val);
	setToggleButton(this, val);
}
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
	if (refresh_id != NaN)
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
	/* Setup footer */
	[
		'controls', 'metadata', 'options',
	].forEach(function(id) {
		document.getElementById('tab.' + id).onclick = show_page;
	});

	/* Setup control tab */
	ui_mpc_status = document.getElementById('status');
	ui_mpc_metadata = document.getElementById('metadata');
	[
		'consume', 'next', 'pause', 'play', 'previous', 'random', 'repeat',
		'seekcur', 'setvol', 'single', 'stop',
	].forEach(function(id) {
		var ele = window['ui_mpc_' + id] = document.getElementById(id);
		ele.onclick = window['tramp_mpc_' + id];
		ele.title = id;
	});

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

	if ('file' in state) {
		// Hack: should be a real object.
		ui_mpc_metadata.innerText = state['file'];
		return;
	}

	var time;
	if ('time' in state)
		// When stopped, there is no time field at all.
		time = state.time.split(':');
	else
		time = [0, 0];
	window['ui_mpc_seekcur'].max = time[1];
	window['ui_mpc_seekcur'].value = time[0];

	window['ui_mpc_setvol'].value = state.volume;
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
