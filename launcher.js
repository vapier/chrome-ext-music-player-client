// Written by Mike Frysinger <vapier@gmail.com>.  Released into the public domain.  Suck it.

chrome.app.runtime.onLaunched.addListener(function() {
	chrome.app.window.create('main.html', {
		bounds: {
			width: 300,
			height: 120
		}
	});
});
