#!/bin/bash
set -e

echo "Starting InvoiceCore environment cleanup (Akaunting, Plane, MinIO)..."

# 1. Stop abolilshed containers if they exist
echo "Stopping abolished containers..."
docker stop invoicecore-minio invoicecore-akaunting invoicecore-plane 2>/dev/null || true
docker rm invoicecore-minio invoicecore-akaunting invoicecore-plane 2>/dev/null || true

# 2. Prune volumes
echo "Removing abolished volumes..."
docker volume rm invoicecore_minio_data invoicecore_akaunting_data invoicecore_plane_data 2>/dev/null || true

# 3. DB Cleanup for Plane & Akaunting Integrations (if any references exist in InvoiceCore)
echo "Scrubbing DB of abolished integration links..."
docker exec invoicecore-db psql -U postgres -d invoice_core_db -c "
DELETE FROM client_credentials WHERE service_name IN ('Akaunting', 'Plane');
DELETE FROM system_settings WHERE key IN ('MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'AKAUNTING_API', 'PLANE_API');
" || true

echo "Cleanup complete. You can now run 'docker-compose up -d' with the new manifest."
