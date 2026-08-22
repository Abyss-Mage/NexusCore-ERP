package mqtt

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	mqttclient "github.com/eclipse/paho.mqtt.golang"
)

// BambuClient holds the MQTT connection
type BambuClient struct {
	Client  mqttclient.Client
	Printer models.Printer
}

var (
	activeClients   = make(map[int]*BambuClient)
	activeClientsMu sync.RWMutex
)

// InitBambuClients fetches all active printers from DB and initiates MQTT connections
func InitBambuClients() {
	var printers []models.Printer
	if err := database.DB.Find(&printers).Error; err != nil {
		log.Printf("[Bambu MQTT] Failed to load printers from database: %v", err)
		return
	}

	for _, p := range printers {
		ConnectPrinter(p)
	}
}

// DisconnectPrinter cleanly terminates an existing MQTT connection for a printer
func DisconnectPrinter(printerID int) {
	activeClientsMu.Lock()
	defer activeClientsMu.Unlock()

	if bc, exists := activeClients[printerID]; exists && bc.Client != nil {
		if bc.Client.IsConnected() {
			bc.Client.Disconnect(250)
		}
		delete(activeClients, printerID)
		log.Printf("[Bambu MQTT] Disconnected printer ID: %d", printerID)
	}
}

// ConnectPrinter establishes an MQTT TLS connection to Bambu Cloud or Local LAN
func ConnectPrinter(p models.Printer) {
	if p.SerialNumber == "" {
		log.Printf("[Bambu MQTT] Skipping printer ID %d (%s) - SerialNumber is required", p.ID, p.Name)
		return
	}

	// Disconnect existing if reconnecting
	DisconnectPrinter(p.ID)

	var broker string
	var username string
	var password string

	isCloud := strings.ToLower(p.ConnectionType) != "lan"

	if isCloud {
		// Bambu Cloud Broker Mode
		region := strings.ToLower(p.CloudRegion)
		if region == "" {
			region = "us"
		}
		switch region {
		case "eu":
			broker = "tls://eu.mqtt.bambulab.com:8883"
		case "cn":
			broker = "tls://cn.mqtt.bambulab.com:8883"
		default:
			broker = "tls://us.mqtt.bambulab.com:8883"
		}

		username = "p2p"
		password = p.CloudToken
		if password == "" {
			log.Printf("[Bambu MQTT] Skipping Cloud Printer %s - Missing CloudToken", p.Name)
			return
		}
	} else {
		// Local LAN Mode
		if p.IPAddress == "" || p.AccessCode == "" {
			log.Printf("[Bambu MQTT] Skipping LAN Printer %s - Missing IPAddress or AccessCode", p.Name)
			return
		}
		broker = fmt.Sprintf("tls://%s:8883", p.IPAddress)
		username = "bblp"
		password = p.AccessCode
	}

	opts := mqttclient.NewClientOptions()
	opts.AddBroker(broker)
	clientID := fmt.Sprintf("invoicecore_%s_%d", p.SerialNumber, time.Now().Unix()%10000)
	opts.SetClientID(clientID)
	opts.SetUsername(username)
	opts.SetPassword(password)

	// Strict TLS for Bambu Cloud broker, self-signed bypass only for local LAN printer hardware
	tlsConfig := &tls.Config{
		InsecureSkipVerify: !isCloud,
	}
	opts.SetTLSConfig(tlsConfig)

	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(30 * time.Second)
	opts.SetKeepAlive(30 * time.Second)

	printerID := p.ID
	serialNumber := p.SerialNumber

	opts.OnConnect = func(c mqttclient.Client) {
		modeStr := "Cloud"
		if !isCloud {
			modeStr = "LAN"
		}
		log.Printf("[Bambu MQTT] Connected to printer %s (Serial: %s, Mode: %s)", p.Name, serialNumber, modeStr)

		// Subscribe to telemetry report topic
		topic := fmt.Sprintf("device/%s/report", serialNumber)
		if token := c.Subscribe(topic, 0, func(client mqttclient.Client, msg mqttclient.Message) {
			handleBambuMessage(serialNumber, msg.Payload())
		}); token.Wait() && token.Error() != nil {
			log.Printf("[Bambu MQTT] Failed to subscribe to topic %s: %v", topic, token.Error())
		} else {
			log.Printf("[Bambu MQTT] Subscribed to telemetry topic: %s", topic)
		}

		// Update online status in DB
		now := time.Now()
		database.DB.Model(&models.Printer{}).Where("id = ?", printerID).Updates(map[string]interface{}{
			"status":    "Active",
			"last_seen": &now,
		})
	}

	opts.OnConnectionLost = func(c mqttclient.Client, err error) {
		log.Printf("[Bambu MQTT] Lost connection to printer ID %d (%s): %v", printerID, p.Name, err)
		database.DB.Model(&models.Printer{}).Where("id = ?", printerID).Update("status", "Offline")
	}

	client := mqttclient.NewClient(opts)

	go func() {
		if token := client.Connect(); token.Wait() && token.Error() != nil {
			log.Printf("[Bambu MQTT] Initial connection failed for %s (%s): %v", p.Name, broker, token.Error())
			database.DB.Model(&models.Printer{}).Where("id = ?", printerID).Update("status", "Offline")
		}
	}()

	activeClientsMu.Lock()
	activeClients[p.ID] = &BambuClient{
		Client:  client,
		Printer: p,
	}
	activeClientsMu.Unlock()
}

// handleBambuMessage processes incoming real-time telemetry from Bambu Lab
func handleBambuMessage(serialNumber string, payloadBytes []byte) {
	var payload map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	printData, ok := payload["print"].(map[string]interface{})
	if !ok {
		return
	}

	updates := map[string]interface{}{}
	now := time.Now()
	updates["last_seen"] = &now

	// 1. Progress Percentage
	if percent, ok := printData["mc_percent"].(float64); ok {
		updates["progress"] = int(percent)
	}

	// 2. Temperatures
	if nozzleTemp, ok := printData["nozzle_temper"].(float64); ok {
		updates["nozzle_temp"] = nozzleTemp
	}
	if nozzleTarget, ok := printData["nozzle_target_temper"].(float64); ok {
		updates["nozzle_target_temp"] = nozzleTarget
	}
	if bedTemp, ok := printData["bed_temper"].(float64); ok {
		updates["bed_temp"] = bedTemp
	}
	if bedTarget, ok := printData["bed_target_temper"].(float64); ok {
		updates["bed_target_temp"] = bedTarget
	}

	// 3. Layer Count
	if layerNum, ok := printData["layer_num"].(float64); ok {
		updates["layer_num"] = int(layerNum)
	}
	if totalLayers, ok := printData["total_layer_num"].(float64); ok {
		updates["total_layers"] = int(totalLayers)
	}

	// 4. Remaining Time (minutes)
	if remTime, ok := printData["mc_remaining_time"].(float64); ok {
		updates["remaining_minutes"] = int(remTime)
	}

	// 5. Active Subtask / GCode filename
	if subtask, ok := printData["subtask_name"].(string); ok && subtask != "" {
		updates["current_job"] = subtask
	}

	// 6. Gcode State / Status
	if gcodeState, ok := printData["gcode_state"].(string); ok {
		var status string
		switch strings.ToUpper(gcodeState) {
		case "RUNNING", "PREPARE":
			status = "Printing"
		case "PAUSE":
			status = "Paused"
		case "FINISH":
			status = "Active"
			updates["progress"] = 100
			log.Printf("[Bambu MQTT] Printer %s completed print job!", serialNumber)
		case "FAILED":
			status = "Error"
		case "IDLE":
			status = "Active"
		default:
			status = "Active"
		}
		updates["status"] = status
	}

	if len(updates) > 0 {
		database.DB.Model(&models.Printer{}).Where("serial_number = ?", serialNumber).Updates(updates)
	}
}

// SendBambuCommand sends a control command (pause, resume, stop, light) to a Bambu printer
func SendBambuCommand(printerID int, command string) error {
	activeClientsMu.RLock()
	bc, exists := activeClients[printerID]
	activeClientsMu.RUnlock()

	if !exists || bc.Client == nil || !bc.Client.IsConnected() {
		return fmt.Errorf("printer is not connected via MQTT")
	}

	topic := fmt.Sprintf("device/%s/request", bc.Printer.SerialNumber)
	payload := map[string]interface{}{
		"print": map[string]interface{}{
			"command":     command,
			"sequence_id": fmt.Sprintf("%d", time.Now().Unix()),
		},
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	token := bc.Client.Publish(topic, 0, false, data)
	if token.Wait() && token.Error() != nil {
		return token.Error()
	}

	return nil
}

