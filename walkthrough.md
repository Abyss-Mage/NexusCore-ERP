# Push & Webhook Notifications: Telegram, Discord & WhatsApp Alert Engine

## Summary of Accomplishments

### 1. Omnichannel Alert Dispatcher (`notification_dispatcher.go`)
- **Supported Channels**:
  - 📱 **Telegram Bot**: Formatted HTML/Markdown push messages sent directly to your Bot token and Chat ID.
  - 💬 **Discord Webhooks**: Rich color-coded embed messages (Emerald Green for payments, Gold for print completions, Red for printer clogs & SSL warnings).
  - 🟢 **WhatsApp / Custom Webhooks**: Webhook payloads delivered to WhatsApp Cloud API, Green API, Twilio, or custom endpoints.
  - 🔔 **In-App Notification Bell**: Auto-creates in-app notifications for active users.

---

### 2. Wired Event Triggers

#### 🚨 1. Bambu 3D Print Farm Alerts (`bambu.go`)
- **Print Finished**: Dispatches an instant alert when a print reaches 100% completion with printer name, serial, and GCode model filename.
- **Nozzle Clog / Failure**: Dispatches an immediate critical alert when a printer fails, encounters an extrusion clog, or reports HMS hardware diagnostic warnings.

#### 💰 2. Client Invoice Payments ($$$) (`invoices.go`, `webhooks.go`)
- **Payment Settlement**: Dispatches an instant payment confirmation alert when an invoice is marked as **PAID** (or automatically reconciled via Razorpay, Stripe, or PayPal webhooks) with client name, amount ($$$/₹₹₹), currency, and invoice number.

#### 🔒 3. Domain SSL Expiration Safeguard (`scheduler.go`)
- **$\le 14$ Days Expiry Warning**: Dispatches proactive alert warnings when any domain SSL certificate or registration is $\le 14$ days from expiration so you never suffer an outage.

---

### 3. Frontend Integrations & Notification Hub (`/integrations`)
- Interactive cards for **Telegram Bot**, **Discord Webhook**, and **WhatsApp/Webhooks**.
- Event subscription toggle switches:
  - `🚨 Bambu Print Finished`
  - `🚨 Nozzle Clog / Failure`
  - `💰 Client Paid Invoice`
  - `🔒 SSL Expiring (<= 14 Days)`
- **"Send Test Alert"** buttons for every channel with instant delivery verification.

---

## Deployment Instructions for VM

Run the following on your server to pull and deploy the update:
```bash
cd /opt/nexus-erp
git pull origin main
docker compose up -d --build
```
