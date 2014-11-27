package gorillaChan

import (
	"encoding/json"
	"log"
)

type Room struct {
	name    string
	members map[*connection]bool
	stop    chan bool
	join    chan *connection
	leave   chan *connection
	send    chan []byte
}

var rooms = make(map[string]*Room)

func (r *Room) run() {
	for {
		select {
		case conn := <-r.join:
			payload := map[string]string{
				"room":    r.name,
				"event":   "join",
				"payload": conn.id,
			}
			data, err := json.Marshal(&payload)
			if err == nil {
				conn.send <- data
			}
			r.members[conn] = true
		case conn := <-r.leave:
			if _, ok := r.members[conn]; ok {
				payload := map[string]string{
					"room":    r.name,
					"event":   "leave",
					"payload": conn.id,
				}
				data, err := json.Marshal(&payload)
				if err == nil {
					conn.send <- data
				}
				delete(r.members, conn)
			}
		case data := <-r.send:
			for conn := range r.members {
				select {
				case conn.send <- data:
				default:
					close(conn.send)
					delete(r.members, conn)
				}
			}
		case <-r.stop:
			return
		}
	}
}

func NewRoom(name string) *Room {
	r := Room{
		name:    name,
		members: make(map[*connection]bool),
		stop:    make(chan bool),
		join:    make(chan *connection),
		leave:   make(chan *connection),
		send:    make(chan []byte, 256),
	}
	rooms[name] = &r
	go r.run()
	return &r
}

func (r *Room) Stop() {
	r.stop <- true
}

func (r *Room) Join(conn *connection) {
	r.join <- conn
}

func (r *Room) Leave(conn *connection) {
	r.leave <- conn
}

func (r *Room) Emit(payload map[string]string) {
	data, err := json.Marshal(&payload)
	if err != nil {
		log.Println(err)
		return
	}
	r.send <- data
}
