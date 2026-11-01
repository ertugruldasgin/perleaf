package collab

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	writeTimeout = 10 * time.Second
	sendBuffer   = 64
	readLimit    = 4 << 20 // 4 MB
)

type Hub struct {
	mu    sync.Mutex
	rooms map[string]map[*client]struct{}
}

type client struct {
	conn *websocket.Conn
	send chan []byte
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[string]map[*client]struct{})}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	room := r.PathValue("project")

	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(readLimit)

	c := &client{conn: conn, send: make(chan []byte, sendBuffer)}
	h.join(room, c)
	defer h.leave(room, c)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	go c.writeLoop(ctx)

	for {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			return
		}
		h.broadcast(room, c, msg)
	}
}

func (h *Hub) join(room string, c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[room] == nil {
		h.rooms[room] = make(map[*client]struct{})
	}
	h.rooms[room][c] = struct{}{}
}

func (h *Hub) leave(room string, c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms[room], c)
	if len(h.rooms[room]) == 0 {
		delete(h.rooms, room)
	}

}

func (h *Hub) broadcast(room string, from *client, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.rooms[room] {
		if c == from {
			continue
		}
		select {
		case c.send <- msg:
		default:
			c.conn.CloseNow()
		}
	}
}

func (c *client) writeLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-c.send:
			wctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := c.conn.Write(wctx, websocket.MessageBinary, msg)
			cancel()
			if err != nil {
				c.conn.CloseNow()
				return
			}
		}
	}
}
