package gorillaChan

import (
	"code.google.com/p/go-uuid/uuid"
	"encoding/json"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"strconv"
	"time"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type connection struct {
	socket *websocket.Conn
	id     string
	send   chan []byte
	rooms  map[string]*Room
}

func (conn *connection) handleData(origData map[string]interface{}) {
	parsedData := make(map[string]string)
	for key, value := range origData {
		switch value.(type) {
		case int64:
			parsedData[key] = strconv.FormatInt(value.(int64), 10)
		case float64:
			parsedData[key] = strconv.FormatFloat(value.(float64), 'f', 6, 64)
		case bool:
			parsedData[key] = strconv.FormatBool(value.(bool))
		case []byte:
			parsedData[key] = string(value.([]byte))
		case string:
			parsedData[key] = value.(string)
		case nil:
			parsedData[key] = ""
		case time.Time:
			parsedData[key] = value.(time.Time).String()
		}
	}
	if event, ok := parsedData["event"]; ok {
		if event == "join" {
			if name, ok := parsedData["room"]; ok {
				conn.Join(name)
			}
		} else if event == "leave" {
			if name, ok := parsedData["room"]; ok {
				conn.Leave(name)
			}
		} else {
			conn.Emit(parsedData)
		}
	}
}

func (conn *connection) readPump() {
	defer func() {
		for _, room := range conn.rooms {
			room.leave <- conn
		}
		conn.socket.Close()
	}()
	conn.socket.SetReadLimit(maxMessageSize)
	conn.socket.SetReadDeadline(time.Now().Add(pongWait))
	conn.socket.SetPongHandler(func(string) error {
		conn.socket.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		origData := make(map[string]interface{})
		_, msg, err := conn.socket.ReadMessage()
		if err != nil {
			if err.Error() != "EOF" {
				log.Println("error parsing incoming json:", err.Error())
			}
			break
		}
		json.Unmarshal(msg, &origData)
		conn.handleData(origData)
	}
}

func (conn *connection) write(mt int, payload []byte) error {
	conn.socket.SetWriteDeadline(time.Now().Add(writeWait))
	return conn.socket.WriteMessage(mt, payload)
}

func (conn *connection) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		conn.socket.Close()
	}()
	for {
		select {
		case msg, ok := <-conn.send:
			if !ok {
				conn.write(websocket.CloseMessage, []byte{})
				return
			}
			if err := conn.write(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			if err := conn.write(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		}
	}
}

func (conn *connection) Join(name string) {
	var room *Room

	if _, ok := rooms[name]; ok {
		room = rooms[name]
	} else {
		room = NewRoom(name)
	}
	room.Join(conn)
	conn.rooms[name] = room
}

func (conn *connection) Leave(name string) {
	if room, ok := rooms[name]; ok {
		room.Leave(conn)
		delete(conn.rooms, room.name)
	}
}

func (conn *connection) Emit(payload map[string]string) {
	if name, ok := payload["room"]; ok {
		if room, ok := rooms[name]; ok {
			room.Emit(payload)
		}
	}
}

func NewConnection(w http.ResponseWriter, r *http.Request) *connection {
	socket, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return nil
	}
	conn := &connection{
		socket: socket,
		id:     uuid.New(),
		send:   make(chan []byte, 256),
		rooms:  make(map[string]*Room),
	}
	return conn
}

func SocketHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", 405)
		return
	}
	conn := NewConnection(w, r)
	if conn != nil {
		go conn.writePump()
		conn.Join("root")
		conn.readPump()
	}
}
