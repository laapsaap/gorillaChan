var App = (function App(global) {
    'use strict';

    var socket = gorillaChan('ws://localhost:8080/ws');

    socket.on('open', function () {
        var chan;

        console.log('opened socket');
        chan = socket.join('testchan');
        chan.on('custom', function (data) {
            console.log('received custom message: ' + data);
        });
        chan.send('custom', 'hello world!');
    });
    socket.on('close', function () {
        console.log('closed socket');
    });
    socket.on('error', function (e) {
        console.log('socket error: ' + e);
    });

}(window || this));
