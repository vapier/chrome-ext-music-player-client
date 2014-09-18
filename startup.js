hide_on_status_change ('pause');

var playlist_for_stuff = document.getElementById ('playlist');
var prev_for_stuff = playlist_for_stuff.innerText;
var iterator_for_stuff = 0;

var intervalsetting = setInterval (function () {
  var q = playlist_for_stuff.innerText;
  if (q != prev_for_stuff) {
    clearInterval (intervalsetting);
  } else {
    prev_for_stuff = q;
    
    if (iterator_for_stuff % 8 == 0) {
      show_page ('controls');
    }
    document.getElementsByClassName('options')[0].className = 'options hiding';
    document.getElementsByClassName('show_options')[0].onclick = function () {
      if (document.getElementsByClassName('options')[0].className == "options hiding") {
        document.getElementsByClassName('options')[0].className = 'options';
      } else {
        document.getElementsByClassName('options')[0].className = 'options hiding';
      }
    };
    switch (ui_mpc_status.innerText) {
      case "Playing":
        hide_on_status_change ('play');
        break;
      case "Paused":
        hide_on_status_change ('pause');
        break;
      case "Stopped":
        hide_on_status_change ('stop');
        break;
    }
  }
  ++iterator_for_stuff;
}, 25)

