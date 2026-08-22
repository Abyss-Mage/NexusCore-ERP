# ⚡ NexusCore ERP

<div align="center">

![NexusCore ERP Banner](https://img.shields.io/badge/Safehouse_Studios-Flagship_AI_Project_%231-00d2ff?style=for-the-badge&logo=codeforces&logoColor=white)
![Go Version](https://img.shields.io/badge/Go-1.23-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ARM64%20%7C%20AMD64-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Licensing](https://img.shields.io/badge/License-FairCode_Open_Source-emerald?style=for-the-badge)

**Next-Generation Multi-Tenant Hybrid ERP, 3D Manufacturing Farm & Software Agency Management Platform.**

*Engineered by Safehouse Studios • 1st AI Assisted Development Project*

</div>

---

## 🌟 Overview

**NexusCore ERP** is a modern, unified Enterprise Resource Planning (ERP) and business management platform designed for multi-vertical founders, makerspaces, 3D printing farms, and software development agencies.

It natively consolidates **E-Commerce / Hardware Manufacturing** (like *TYTGEAR*) and **Software Consulting & Cloud Services** (like *Safehouse Studios*) into clean, isolated company workspaces with modular navigation.

---

## 🚀 Key Modules & Capabilities

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ⚡ NEXUSCORE ERP HUB                                   │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          ▼                                ▼                                ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   🖨️ 3D FARM     │             │  💻 DEV AGENCY   │             │   💼 CORE CRM    │
├──────────────────┤             ├──────────────────┤             ├──────────────────┤
│ • Bambu MQTT     │             │ • Milestones     │             │ • Invoices & QTs │
│ • Spool Grams    │             │ • Retainers      │             │ • Client CRM     │
│ • Unit Economics │             │ • Domains & SSL  │             │ • Expense Ledger │
│ • Print Kanban   │             │ • Secret Vault   │             │ • GST Tax / HSN  │
│ • WooCommerce    │             │ • Server Uptime  │             │ • PDF Generator  │
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

### 1. 🏢 Multi-Tenant Singular Workspaces
- **Strict Tenant Isolation**: Invoices, clients, expenses, and ledgers automatically scope to the active company workspace.
- **Dynamic Company Creator**: Add custom business workspaces with dedicated currencies (₹, $, €, £), tax IDs, and numbering prefixes (e.g. `SHS-INV-`, `TYT-INV-`).
- **Adaptive Sidebar Navigation**: The interface automatically tailors its navigation based on the active company's industry template.

### 2. 🖨️ 3D Printing Farm & E-Commerce (e.g., TYTGEAR)
- **Bambu Lab MQTT Cloud Telemetry**: Real-time nozzle/bed temperatures, print progress, AMS multi-color slot status, and live error alerts.
- **Spool Inventory**: Track material weight (grams), spool costs, and color stock.
- **True Unit Economics ROI Matrix**: Machine depreciation, electricity kWh costs, labor, and profit margin analysis per print job.
- **WooCommerce Auto-Sync**: Ingests store orders, creates paid invoices, and auto-queues print jobs on the Kanban board.

### 3. 💻 Software Agency & Cloud Operations (e.g., Safehouse Studios)
- **Sprint Milestones**: Project tracking with percentage deliverables and 1-click invoice generation.
- **Retainer Contracts**: Monthly recurring retainers with dynamic overage hourly billing.
- **Domain & SSL Monitor**: Automated background certificate expiry tracking and DNS health checks.
- **Zero-Trust AES-256 Credential Vault**: TOTP-protected, end-to-end encrypted password and API key manager with audit trails.
- **Server Uptime Monitors**: Background ping workers tracking server latency, HTTP status codes, and incident logs.

### 4. 🔑 Cryptographic Serial Licensing (Ed25519)
- **Fair-Code Open-Source Core**: Run out-of-the-box in Community Edition with free quotas.
- **Offline Cryptographic Validation**: Asymmetric Ed25519 token verification (100% air-gap and private network safe).
- **Enterprise Key Activation**: Unlock unlimited company workspaces and farm fleets via `/settings/license`.

---

## 🚢 Quickstart with Docker & Dockhand

### 1. Clone the Repository
```bash
git clone https://github.com/anirban-guha/InvoiceCore-DockerDeploy.git nexus-erp
cd nexus-erp
```

### 2. Configure Environment Secrets
Copy `.env.example` to `.env` and configure your production secrets:
```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Exposed HTTP port | `5000` |
| `DB_NAME` | PostgreSQL database name | `nexus_db` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | *Strong random string* |
| `JWT_SECRET` | Authentication token secret | *Random 64-char string* |
| `VAULT_ENCRYPTION_KEY` | AES-256 GCM 32-byte key | *64-character hex string* |
| `ENVIRONMENT` | Runtime mode | `production` |
| `STORAGE_PATH` | Storage mount path | `/app/data` |

### 3. Start the Stack
```bash
docker compose up -d --build
```

Access the web dashboard at: **`http://localhost:5000`** (or your domain).

---

## 🔑 Commercial Licensing & Enterprise Features

NexusCore ERP is released under a **Fair-Code Open-Source / Dual License**:
- **Community Edition (Free)**: Out-of-the-box self-hosting with essential financial tools, single-workspace management, and standard community quotas.
- **Enterprise Commercial License**: Unlocks unlimited multi-business workspaces, multi-tenant company creation, full Bambu 3D Farm fleet telemetry, Zero-Trust Credential Vault, and WooCommerce order auto-sync.

Commercial serial keys (`NEXUS-XXXX-XXXX-...`) are cryptographically signed using **Ed25519 asymmetric cryptography** and validated 100% offline without requiring outbound telemetry.

To obtain an Enterprise License serial key for your organization, visit **[Safehouse Studios](https://safehousestudios.tech)**.

---

## 🏛️ Technology Stack

- **Backend**: Go 1.23, Gin Web Framework, GORM ORM, SQLite & PostgreSQL 16 drivers, Paho MQTT.
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Radix UI.
- **Security**: Ed25519 Cryptography, AES-256-GCM Zero-Trust Vault, Argon2 / Bcrypt password hashing, JWT authentication.
- **DevOps**: Multi-Stage Dockerfile (Alpine), Docker Compose, Dockhand, Caddy Reverse Proxy.

---

## 📄 License & Credits

- **Developer**: [Safehouse Studios](https://safehousestudios.tech)
- **Project**: 1st AI Assisted Development Project by Safehouse Studios
- **Edition**: Dual Licensed — Fair-Code Open Source & Commercial Enterprise
