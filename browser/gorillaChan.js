//    Title: gorilla-chan.js
//    Author: Jon Cody
//    Year: 2014
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.


(function (global) {
    'use strict';

/**
 * eventEmitter
 * Turn an object into an event emitter.
 * @params {Object} emitter
 * @return {Object} emitter
 */
    function eventEmitter(emitter) {
        emitter = emitter && typeof emitter === 'object' ? emitter : {};
        emitter.events = {};
        emitter.addListener = function (type, listener) {
            var list = emitter.events[type];

            if (typeof listener === 'function') {
                if (emitter.events.newListener) {
                    emitter.emit('newListener', type, typeof listener.listener === 'function' ?
                            listener.listener : listener);
                }
                if (!list) {
                    emitter.events[type] = [listener];
                } else {
                    emitter.events[type].push(listener);
                }
            }
            return emitter;
        };

/**
 * emmitter.on
 * Add an event listener.
 * @param {String} type
 * @param {Function} listener
 * @return {Object} emitter
 */
        emitter.on = emitter.addListener;

/**
 * emmitter.once
 * Add an event listener.
 * @param {String} type
 * @param {Function} listener
 * @return {Object} emitter
 */
        emitter.once = function (type, listener) {
            function g() {
                emitter.removeListener(type, g);
                listener.apply(emitter, arguments);
            }
            if (typeof listener === 'function') {
                g.listener = listener;
                emitter.on(type, g);
            }
            return emitter;
        };

/**
 * emmitter.removeListener
 * Remove an event listener.
 * @param {String} type
 * @param {Function} listener
 * @return {Object} emitter
 */
        emitter.removeListener = function (type, listener) {
            var list = emitter.events[type],
                position = -1,
                i;

            if (typeof listener === 'function' && list) {
                for (i = list.length - 1; i >= 0; i -= 1) {
                    if (list[i] === listener || (list[i].listener && list[i].listener === listener)) {
                        position = i;
                        break;
                    }
                }
                if (position >= 0) {
                    if (list.length === 1) {
                        delete emitter.events[type];
                    } else {
                        list.splice(position, 1);
                    }
                    if (emitter.events.removeListener) {
                        emitter.emit('removeListener', type, listener);
                    }
                }
            }
            return emitter;
        };

/**
 * emmitter.off
 * Remove an event listener.
 * @param {String} type
 * @param {Function} listener
 */
        emitter.off = emitter.removeListener;

/**
 * emmitter.removeAllListeners
 * Remove all event listeners.
 * @param {String} type
 * @return {Object} emitter
 */
        emitter.removeAllListeners = function (type) {
            var list,
                i;

            if (!emitter.events.removeListener) {
                if (!type) {
                    emitter.events = {};
                } else {
                    delete emitter.events[type];
                }
            } else if (!type) {
                Object.keys(emitter.events).forEach(function (key) {
                    if (key !== 'removeListener') {
                        emitter.removeAllListeners(key);
                    }
                });
                emitter.removeAllListeners('removeListener');
                emitter.events = {};
            } else {
                list = emitter.events[type];
                for (i = list.length - 1; i >= 0; i -= 1) {
                    emitter.removeListener(type, list[i]);
                }
                delete emitter.events[type];
            }
            return emitter;
        };

/**
 * emitter.listeners
 * List all listeners of a specified type.
 * @param {String} type
 * @return {Array} list
 */
        emitter.listeners = function (type) {
            var list = [];

            if (type) {
                if (emitter.events[type]) {
                    list = emitter.events[type];
                }
            } else {
                Object.keys(emitter.events).forEach(function (key) {
                    list.push(emitter.events[key]);
                });
            }
            return list;
        };

/**
 * emitter.emit
 * Emit an event.
 * @param {String} type
 * @return {Object} emitter
 */
        emitter.emit = function (type) {
            var list = emitter.events[type],
                bool = false,
                args = [],
                length,
                i;

            if (list) {
                length = arguments.length;
                for (i = 1; i < length; i += 1) {
                    args[i - 1] = arguments[i];
                }
                length = list.length;
                for (i = 0; i < length; i += 1) {
                    list[i].apply(emitter, args);
                }
                bool =  true;
            }
            return bool;
        };

        return emitter;
    }

    global.eventEmitter = eventEmitter;





/**
 * GorillaChan
 * Contsructor of GorillaChan
 * @param {String} url
 * @param {String || Array} protocol
 */
    function GorillaChan(url) {
        if (global.WebSocket && typeof url === 'string') {
            eventEmitter(this);
            this.open = false;
            this.id = '';
            this.rooms = {};
            this.socket = new WebSocket(url);
            this.socket.onopen = this.onopen.bind(this);
            this.socket.onmessage = this.onmessage.bind(this);
            this.socket.onclose = this.onclose.bind(this);
            this.socket.onerror = this.onerror.bind(this);
        }
    }

/**
 * GorillaChan._handleMessage
 * Internal method used to hangle the contents of a message after it has been received.
 * @param {String} room
 * @param {String} event
 * @param {String || Array || Object} payload
 */
    GorillaChan.prototype._handleMessage = function _handleMessage(room, event, payload) {
        if (event && typeof event === 'string' && room && typeof room === 'string' && payload) {
            if (room === 'root') {
                if (event === 'join') {
                    this.id = payload;
                } else if (event === 'leave') {
                    this.close();
                } else {
                    this.emit(event, payload);
                }
            } else if (this.rooms.hasOwnProperty(room)) {
                if (event === 'join') {
                    this.rooms[room].emit('open');
                } else if (event === 'leave') {
                    this.rooms[room].emit('close');
                    delete this.rooms[room];
                } else {
                    this.rooms[room].emit(event, payload);
                }
            }
        }
    };

/**
 * GorillaChan.onopen
 * Called when this instance of GorillaChan is opened.
 */
    GorillaChan.prototype.onopen = function onopen() {
        this.open = true;
        this.emit('open');
    };

/**
 * GorillaChan.onmessage
 * Called when a message is received.
 * @param {Event} e
 */
    GorillaChan.prototype.onmessage = function onmessage(e) {
        var data = e.data,
            room,
            event,
            payload;

        try {
            data = JSON.parse(data);
        } catch (ignore) {
            return console.log("Invalid message format: Not JSON");
        }
        if (data.payload) {
            try {
                payload = JSON.parse(data.payload);
            } catch (ignore) {
                payload = data.payload;    
            }
        } else {
            payload = {};
        }
        event = data.event;
        room = data.room;
        this._handleMessage(room, event, payload);
    };

/**
 * GorillaChan.onclose
 * Called when an instance of GorillaChan closes.
 */
    GorillaChan.prototype.onclose = function onclose() {
        this.open = false;
        this.emit('close');
    };

/**
 * GorillaChan.onerror
 * Called when an error occurs on an instance of GorillaChan.
 * @param {Event} e
 */
    GorillaChan.prototype.onerror = function onerror(e) {
        this.emit('error', e);
    };

/**
 * GorillaChan.send
 * Send a message.
 * @param {String} room
 * @param {String} event
 * @param {String || Array || Object || Number}
 */
    GorillaChan.prototype.send = function send(room, event, payload) {
        var data = {};

        if (event && room && typeof room === 'string' && !payload) {
            payload = event;
            event = room;
            room = 'root';
        }
        if (this.open && typeof room === 'string' && typeof event === 'string' && payload && (room === 'root' || this.rooms.hasOwnProperty(room))) {
            data.room = room;
            data.event = event;
            data.payload = payload;
            if (typeof payload === 'object' || Array.isArray(payload)) {
                try {
                    data.payload = JSON.stringify(payload);
                } catch (ignore) {}
            }
            this.socket.send(JSON.stringify(data));
        }
    };

/**
 * GorillaChan.join
 * Join a room. Returns an eventEmitter object with the methods 'send' and 'leave'.
 * @param {String} room
 * @return {Object} sock
 */
    GorillaChan.prototype.join = function join(room) {
        var data = {
                event: 'join',
                room: room,
                payload: {}
            },
            sock = {};

        if (this.open && room && typeof room === 'string' && !this.rooms.hasOwnProperty(room)) {
            eventEmitter(sock);
            sock.room = room;
            sock.send = this.send.bind(this, room);
            sock.leave = this.leave.bind(this, room);
            this.rooms[room] = sock;
            this.socket.send(JSON.stringify(data));
        }
        return sock;
    };

/**
 * GorillaChan.leave
 * Leave a room.
 * @param {String} room
 */
    GorillaChan.prototype.leave = function leave(room) {
        var data = {
                event: 'leave',
                room: room,
                payload: {}
            };

        if (this.open && room && typeof room === 'string' && this.rooms.hasOwnProperty(room)) {
            this.socket.send(JSON.stringify(data));
        }
    };

/**
 * GorillaChan.close
 * Close an instance of GorillaChan.
 */
    GorillaChan.prototype.close = function close() {
        if (this.open) {
            Object.keys(this.rooms).forEach(function (room) {
                this.rooms[room].emit('close');
                delete this.rooms[room];
            }, this);
            this.socket.close();
        }
    };

    global.gorillaChan = function gorillaChan(url) {
        return new GorillaChan(url);
    };

}(this || window));
