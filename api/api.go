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



func main() {
	go chat_loop()
}

func chat_loop() {
	for {
		if stream_started() {
			enter_chat()
			for {
				if stream_ended() {
					exit_chat()
					break
				}
				count()
				if 30 seconds have passed {
					send_count()
					reset_count()
				}
			}
		}
	}

}