// pseudo:

// main go routine checks if NL's stream has started every 5 minutes
// if it has, enters the chat
// while the chat is live, counts positive and negative integers
// every 30 seconds, sends the current count to a postgres instance that will generate a timestamp
// resets count after
// if the chat ends, exits the chat and waits for the next stream to start

//api route
// /api/sum?from=2020-01-01&to=2020-01-01&interval=day, e.g

// postgres table
// id, timestamp, count (pos/neg int)

package main

import "time"

func main() {
	go chat_loop()
}

func chat_loop() {
	stream_start_ticker := time.NewTicker(5 * time.Minute)
	for range stream_start_ticker.C {
		stream_live, stream_end, err := stream_started()
		if err != nil {
			// log error
			continue
		}
		if stream_live {
			post_count_ticker := time.NewTicker(30 * time.Second)
			message_channel, err := enter_chat()
			if err != nil {
				// log error
				continue
			}
			for {
				count := 0
				select {
				case <-post_count_ticker.C:
					post_count(count)
					count = 0
				case <-message_channel:
					message := <-message_channel
					message_value := parse_val(message.text)
					count += message_value
				case <-stream_end:
					break
				}
			}
		}

	}
}

func post_count(count int) {
	// post to postgres
}

func parse_val(text string) int {
	return 0
}

func stream_started() (bool, chan bool, error) {
	return true, make(chan bool), nil
}

func enter_chat() (chan Message, error) {
	return make(chan Message), nil
}

type Message struct {
	text string
}
