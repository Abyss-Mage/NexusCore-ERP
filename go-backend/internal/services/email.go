package services

import (
	"fmt"

	"github.com/anirban-guha/invoicecore/internal/models"
	"gopkg.in/gomail.v2"
)

type SMTPConfig struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	User      string `json:"user"`
	Password  string `json:"password"`
	FromEmail string `json:"from_email"`
	FromName  string `json:"from_name"`
}

// SendEmail sends an email using the configured SMTP settings
func SendEmail(config SMTPConfig, to, subject, htmlBody string, attachments ...string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("%s <%s>", config.FromName, config.FromEmail))
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", htmlBody)

	for _, attachment := range attachments {
		m.Attach(attachment)
	}

	d := gomail.NewDialer(config.Host, config.Port, config.User, config.Password)

	return d.DialAndSend(m)
}

// GetSMTPConfig retrieves SMTP configuration from system settings
func GetSMTPConfig(setting *models.SystemSetting) (*SMTPConfig, error) {
	if setting == nil || setting.JSONValue == nil {
		return nil, fmt.Errorf("SMTP not configured")
	}

	jsonVal := *setting.JSONValue
	config := &SMTPConfig{
		Host:      getStringFromMap(jsonVal, "host"),
		Port:      getIntFromMap(jsonVal, "port"),
		User:      getStringFromMap(jsonVal, "user"),
		Password:  getStringFromMap(jsonVal, "password"),
		FromEmail: getStringFromMap(jsonVal, "from_email"),
		FromName:  getStringFromMap(jsonVal, "from_name"),
	}

	if config.Host == "" {
		return nil, fmt.Errorf("SMTP host not configured")
	}

	return config, nil
}

func getStringFromMap(m models.JSONMap, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getIntFromMap(m models.JSONMap, key string) int {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return int(f)
		}
	}
	return 0
}
