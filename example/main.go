package main

import (
	"github.com/joncody/gorillaChan"
	"html/template"
	"log"
	"net/http"
)

var templates = template.Must(template.ParseGlob("./templates/*"))

func indexHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		templates.ExecuteTemplate(w, "index", nil)
	} else {
		http.Error(w, "Method not allowed", 405)
	}
}

func staticHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, r.URL.Path[1:])
}

func main() {
	http.HandleFunc("/", indexHandler)
	http.HandleFunc("/ws", gorillaChan.SocketHandler)
	http.HandleFunc("/static/", staticHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
