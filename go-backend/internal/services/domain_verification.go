package services

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

// VerifyDomainRecord actively checks the internet for SSL and DNS records of the given domain
func VerifyDomainRecord(domain string) (*models.ClientDomain, error) {
	result := &models.ClientDomain{
		DomainName: domain,
	}

	// 1. Verify SSL
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 5 * time.Second}, "tcp", domain+":443", &tls.Config{
		InsecureSkipVerify: false,
	})

	if err == nil {
		defer conn.Close()
		certs := conn.ConnectionState().PeerCertificates
		if len(certs) > 0 {
			result.HasSSL = true
			result.SSLExpiryDate = &certs[0].NotAfter
			result.SSLIssuer = certs[0].Issuer.CommonName
		}
	} else {
		result.HasSSL = false
	}

	// 2. Lookup A Records
	ips, err := net.LookupIP(domain)
	if err == nil {
		var ipStrs []string
		for _, ip := range ips {
			ipStrs = append(ipStrs, ip.String())
		}
		aRecBytes, _ := json.Marshal(ipStrs)
		result.ARecords = string(aRecBytes)
	} else {
		result.ARecords = "[]"
	}

	// 3. Lookup MX Records
	mxs, err := net.LookupMX(domain)
	if err == nil {
		var mxStrs []string
		for _, mx := range mxs {
			mxStrs = append(mxStrs, fmt.Sprintf("%s (Pref: %d)", mx.Host, mx.Pref))
		}
		mxBytes, _ := json.Marshal(mxStrs)
		result.MXRecords = string(mxBytes)
	} else {
		result.MXRecords = "[]"
	}

	// 4. Lookup TXT Records
	txts, err := net.LookupTXT(domain)
	if err == nil {
		var txtStrs []string
		for _, txt := range txts {
			// Some TXT records can be long, so we join them just in case
			txtStrs = append(txtStrs, txt)
		}
		txtBytes, _ := json.Marshal(txtStrs)
		result.TXTRecords = string(txtBytes)
	} else {
		result.TXTRecords = "[]"
	}

	now := time.Now()
	result.LastCheckedAt = &now

	return result, nil
}

// UpdateDomainRecords fetches latest records and updates the DB model
func UpdateDomainRecords(domainModel *models.ClientDomain) error {
	// Remove any protocol like https:// or trailing slashes just to be safe
	cleanDomain := strings.TrimSpace(domainModel.DomainName)
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")
	cleanDomain = strings.TrimRight(cleanDomain, "/")

	freshData, err := VerifyDomainRecord(cleanDomain)
	if err != nil {
		return err
	}

	domainModel.HasSSL = freshData.HasSSL
	domainModel.SSLExpiryDate = freshData.SSLExpiryDate
	domainModel.SSLIssuer = freshData.SSLIssuer
	domainModel.ARecords = freshData.ARecords
	domainModel.MXRecords = freshData.MXRecords
	domainModel.TXTRecords = freshData.TXTRecords
	domainModel.LastCheckedAt = freshData.LastCheckedAt

	return database.DB.Save(domainModel).Error
}
