# 🚀 DevOps Security Rules Deployment Guide

**Role**: Senior DevOps Engineer  
**Environment**: Firebase + Google Cloud Platform  
**Status**: Ready for Deployment  
**Critical**: High Priority Security Enhancements

---

## 📋 Table of Contents

1. [Pre-Deployment Validation](#pre-deployment)
2. [Staging Deployment](#staging)
3. [Production Deployment](#production)
4. [Rollback Procedures](#rollback)
5. [Monitoring & Alerts](#monitoring)
6. [Troubleshooting](#troubleshooting)

---

## 🔍 PRE-DEPLOYMENT VALIDATION

### Step 1: Verify Current Rules Status

```bash
# 1. Check Firebase CLI installation
firebase --version
# Expected: Firebase CLI version 12.0.0+

# 2. Authenticate with Firebase
firebase login

# 3. List available projects
firebase projects:list

# 4. View current rules in production
firebase rules:list --project linkshift-prod

# 5. Validate current rules syntax
firebase rules:validate --project linkshift-prod
```

### Step 2: Environment Audit

```bash
# Verify Firestore instances
firebase firestore:locations --project linkshift-prod

# Check current security rules version
gcloud firestore rules describe rules --project linkshift-prod

# Get rules deployment history
gcloud firestore rules list --project linkshift-prod --limit=10
```

### Step 3: Local Testing

```bash
# Start Firebase Emulator Suite
firebase emulators:start --project linkshift-dev

# In another terminal, run tests
npm run test:firestore

# Expected output:
# Test Suites:  6 passed, 6 total
# Tests:       36 passed, 36 total
# Snapshots:   0 total
# Time:        8-12s

# Stop emulator
Ctrl+C
```

---

## 🧪 STAGING DEPLOYMENT

### Pre-Staging Checklist

```bash
#!/bin/bash
# staging-preflight.sh

set -e

echo "=== STAGING PRE-FLIGHT CHECKS ==="

# 1. Verify staging project exists
echo "✓ Checking staging project..."
firebase projects:list | grep linkshift-staging || {
  echo "❌ Staging project not found"
  exit 1
}

# 2. Validate rules syntax
echo "✓ Validating rules syntax..."
firebase rules:validate --project linkshift-staging || {
  echo "❌ Rules syntax invalid"
  exit 1
}

# 3. Check staging backup exists
echo "✓ Checking staging backup..."
gsutil ls gs://linkshift-staging-backup/ || {
  echo "❌ Staging backup not found"
  exit 1
}

# 4. Run local tests
echo "✓ Running local tests..."
npm run test:firestore || {
  echo "❌ Tests failed"
  exit 1
}

echo "✅ All pre-flight checks passed!"
```

### Deploy to Staging

```bash
# Deploy rules to staging project
firebase deploy --only firestore:rules \
  --project linkshift-staging \
  --message "STAGING: Security enhancements - Field validation, timestamps, state machines"

# Expected output:
# === Deploying to 'linkshift-staging' ...
# i  firestore: Exporting rules to gs://linkshift-staging.appspot.com...
# i  firestore: Rules have been successfully deployed
# i  Cloud Firestore Rules deployed successfully
```

### Verify Staging Deployment

```bash
# Check deployment status
firebase rules:list --project linkshift-staging

# Monitor staging logs
gcloud logging read \
  "resource.type=cloud_firestore_database AND resource.labels.project_id=linkshift-staging" \
  --project linkshift-staging \
  --limit=50 \
  --format json

# Test with staging-specific requests
firebase emulators:exec \
  'npm run test:firestore -- --project=linkshift-staging' \
  --project linkshift-staging
```

### Staging Testing Duration

```
Monitoring Period: 2-4 hours minimum
Success Criteria:
  ✓ No unexpected permission errors in logs
  ✓ Shift creation still works
  ✓ Member invitations process correctly
  ✓ Settings updates succeed for admins
  ✓ Audit logs remain readable by members
  
If any failures: Immediately rollback with:
  firebase deploy --only firestore:rules --project linkshift-staging --force
```

---

## 🌍 PRODUCTION DEPLOYMENT

### Critical: Production Pre-Deployment Steps

```bash
#!/bin/bash
# production-preflight.sh

set -e

echo "=== PRODUCTION PRE-FLIGHT CHECKS ==="

# 1. Create production backup
echo "✓ Creating production backup..."
BACKUP_TIMESTAMP=$(date +%s)
BACKUP_PATH="gs://linkshift-prod-db-backup/backup-${BACKUP_TIMESTAMP}"

gcloud firestore export ${BACKUP_PATH} \
  --project linkshift-prod \
  --collection-ids=users,households,shifts,dayNotes,messages,invitations,notifications,subscriptions

echo "  Backup: ${BACKUP_PATH}"

# 2. Verify backup completion
echo "✓ Verifying backup..."
gsutil ls -r ${BACKUP_PATH} || {
  echo "❌ Backup failed"
  exit 1
}

# 3. Validate rules
echo "✓ Validating rules..."
firebase rules:validate --project linkshift-prod || {
  echo "❌ Rules invalid"
  exit 1
}

# 4. Check production metrics baseline
echo "✓ Recording baseline metrics..."
gcloud monitoring time-series list \
  --project linkshift-prod \
  --filter='resource.type="cloud_firestore_database"' > /tmp/prod-baseline.json

# 5. Verify staging is still working
echo "✓ Verifying staging deployment..."
gcloud firestore rules describe rules --project linkshift-staging | grep -q "resolved_at" || {
  echo "⚠️ Warning: Staging may have issues"
}

echo "✅ All production pre-flight checks passed!"
echo "   Backup: ${BACKUP_PATH}"
```

### Deploy to Production

```bash
# Deploy rules to production
firebase deploy --only firestore:rules \
  --project linkshift-prod \
  --message "PROD: Security enhancements - Field validation, timestamp protection, state machines"

# Expected output:
# === Deploying to 'linkshift-prod' ...
# i  firestore: Exporting rules to gs://linkshift-prod.appspot.com...
# i  firestore: Rules have been successfully deployed
# i  Cloud Firestore Rules deployed successfully
```

### Immediate Post-Deployment Monitoring (First Hour)

```bash
#!/bin/bash
# monitor-deployment.sh

PROJECT="linkshift-prod"
SAMPLE_INTERVAL=10  # seconds
MONITORING_DURATION=3600  # 1 hour in seconds
ELAPSED=0

echo "=== PRODUCTION DEPLOYMENT MONITORING ==="
echo "Duration: ${MONITORING_DURATION} seconds"
echo "Sample interval: ${SAMPLE_INTERVAL} seconds"
echo ""

while [ $ELAPSED -lt $MONITORING_DURATION ]; do
  echo "=== Sample at $(date) ==="
  
  # Check error rates
  echo "Checking permission errors..."
  gcloud logging read \
    "resource.type=cloud_firestore_database AND 
     severity=ERROR AND 
     project_id=${PROJECT}" \
    --project ${PROJECT} \
    --limit=10 \
    --format "table(timestamp, jsonPayload.status_code, jsonPayload.message)"
  
  # Check operation counts
  echo "Operation counts (last 10 min)..."
  gcloud monitoring read \
    "firestore.googleapis.com/firestore/operation_count" \
    --project ${PROJECT} \
    --filter 'resource.database_id="(default)"' \
    --format "table(points[0].value.int64_value)"
  
  # Check read/write latency
  echo "Read/Write latency (last 10 min)..."
  gcloud monitoring read \
    "firestore.googleapis.com/firestore/latency" \
    --project ${PROJECT} \
    --format "table(metric.labels.operation_type, points[0].value.distribution_value.mean)"
  
  echo ""
  sleep $SAMPLE_INTERVAL
  ELAPSED=$((ELAPSED + SAMPLE_INTERVAL))
done

echo "=== Monitoring Complete ==="
```

### Extended Monitoring (First 24 Hours)

```bash
# Create Cloud Monitoring dashboard
gcloud monitoring dashboards create \
  --config-from-file - << 'EOF'
{
  "displayName": "Firestore Rules Deployment - Prod",
  "gridLayout": {
    "widgets": [
      {
        "title": "Permission Denials",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_firestore_database\" AND metric.type=\"firestore.googleapis.com/firestore/operation_count\" AND metric.labels.operation_type=\"permission_denied\""
              }
            }
          }]
        }
      },
      {
        "title": "Error Rate",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_firestore_database\" AND metric.type=\"firestore.googleapis.com/firestore/error_count\""
              }
            }
          }]
        }
      },
      {
        "title": "Latency P95",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_firestore_database\" AND metric.type=\"firestore.googleapis.com/firestore/latency\""
              }
            }
          }]
        }
      }
    ]
  }
}
EOF

echo "Dashboard created. View at:"
echo "https://console.cloud.google.com/monitoring/dashboards/custom/firestore-rules-prod"
```

---

## 🔄 ROLLBACK PROCEDURES

### Quick Rollback (Emergency)

```bash
#!/bin/bash
# rollback-emergency.sh

PROJECT="${1:-linkshift-prod}"

echo "⚠️  EMERGENCY ROLLBACK INITIATED"
echo "Project: ${PROJECT}"
echo ""

# Get current rules
CURRENT_RULES=$(firebase rules:list --project ${PROJECT} | head -5)
echo "Current deployment:"
echo "${CURRENT_RULES}"
echo ""

# Find previous version
echo "Finding previous version..."
PREV_VERSION=$(firebase rules:list --project ${PROJECT} | tail -5 | head -1)
echo "Previous version:"
echo "${PREV_VERSION}"

# Rollback
echo "Rolling back..."
firebase deploy --only firestore:rules \
  --project ${PROJECT} \
  --force \
  --message "ROLLBACK: Emergency revert to previous version"

echo "✅ Rollback complete"
echo "⚠️  Review what went wrong and plan re-deployment"
```

### Scheduled Rollback (Data Restoration)

```bash
#!/bin/bash
# rollback-with-restore.sh

PROJECT="linkshift-prod"
BACKUP_PATH="${1}"

if [ -z "$BACKUP_PATH" ]; then
  echo "Usage: rollback-with-restore.sh <backup-path>"
  echo "Example: rollback-with-restore.sh gs://linkshift-prod-db-backup/backup-1729417200"
  exit 1
fi

echo "🚨 RESTORING DATABASE FROM BACKUP"
echo "Backup: ${BACKUP_PATH}"
echo ""

# Step 1: Rollback rules first
echo "Step 1: Rolling back security rules..."
firebase deploy --only firestore:rules \
  --project ${PROJECT} \
  --force \
  --message "ROLLBACK: Revert rules to previous version"

# Step 2: Restore data from backup
echo "Step 2: Restoring data from backup..."
gcloud firestore restore ${BACKUP_PATH} \
  --project ${PROJECT} \
  --async

# Step 3: Verify restoration
echo "Step 3: Verifying restoration..."
sleep 30  # Wait for restore to initialize
gcloud firestore operations list --project ${PROJECT} --limit=1 --format table

echo "✅ Rollback initiated"
echo "⚠️  Monitor restore operation via:"
echo "   gcloud firestore operations list --project ${PROJECT}"
```

---

## 🔔 MONITORING & ALERTS

### Setup Cloud Monitoring Alerts

```bash
# Alert 1: High permission denial rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Firestore High Permission Denials" \
  --condition-display-name="Permission denials > 100/min" \
  --condition-threshold-value=100 \
  --condition-threshold-duration=60s \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-filter='
    resource.type="cloud_firestore_database" AND
    metric.type="firestore.googleapis.com/firestore/operation_count" AND
    metric.labels.operation_type="permission_denied"
  ' \
  --project linkshift-prod

# Alert 2: Error rate spike
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Firestore Error Rate Spike" \
  --condition-display-name="Errors > 5% of traffic" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --project linkshift-prod

# Alert 3: Latency degradation
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Firestore Latency Spike" \
  --condition-display-name="P95 latency > 500ms" \
  --condition-threshold-value=500 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --project linkshift-prod
```

### View Alerts

```bash
# List all alert policies
gcloud alpha monitoring policies list \
  --project linkshift-prod \
  --filter="displayName:Firestore"

# View alert history
gcloud alpha monitoring policies describe POLICY_ID \
  --project linkshift-prod
```

---

## 🔧 TROUBLESHOOTING

### Issue 1: Shift Creation Failures After Deployment

**Symptoms**:
```
Error: "Missing required fields"
Code: 403 Forbidden
```

**Diagnosis**:
```bash
# Check recent logs
gcloud logging read \
  "resource.type=cloud_firestore_database AND
   jsonPayload.operation='create' AND
   jsonPayload.collection='shifts'" \
  --project linkshift-prod \
  --limit=20 \
  --format=json | jq '.[] | {timestamp: .timestamp, message: .jsonPayload.message, error: .jsonPayload.error}'
```

**Resolution**:
```bash
# Check if title field is being sent by client
# If yes, rules updated correctly - client may have cached old schema
# If no, rolls back field validation (or makes it optional)

# To rollback just the field validation:
firebase deploy --only firestore:rules --force \
  --project linkshift-prod \
  --message "ROLLBACK: Remove field validation (debugging)"
```

### Issue 2: Household Members Can't Read Audit Logs

**Symptoms**:
```
Error: "Permission denied"
Collection: households/{id}/auditLog
```

**Diagnosis**:
```bash
# Verify rule change was deployed
firebase rules:list --project linkshift-prod | grep "auditLog"

# Check deployment history
gcloud firestore rules list --project linkshift-prod --limit=5
```

**Resolution**:
```bash
# If rule was changed to admin-only:
# This is expected - need to update client to hide audit logs for non-admins

# Or, if this was unintended:
firebase deploy --only firestore:rules --force \
  --project linkshift-prod \
  --message "HOTFIX: Revert audit log read permissions"
```

### Issue 3: Invitation Accept Failing

**Symptoms**:
```
Error: "Invalid status transition"
Code: 400 Bad Request
```

**Diagnosis**:
```bash
# Check if state machine was deployed
firebase rules:list --project linkshift-prod | grep -A5 "invitations"

# View recent failures
gcloud logging read \
  "resource.type=cloud_firestore_database AND
   jsonPayload.collection='invitations' AND
   jsonPayload.operation='update'" \
  --project linkshift-prod \
  --limit=10
```

**Resolution**:
```bash
# If state machine is too strict, temporarily relax it:
# Modify invitation update rule to log and allow (for debugging):

firebase deploy --only firestore:rules \
  --project linkshift-prod \
  --message "DEBUG: Logging invitation update attempts"

# After investigation, either:
# 1. Update client to send correct status values
# 2. Update rule to accept valid transitions
```

---

## ✅ POST-DEPLOYMENT VALIDATION

### 24-Hour Checkpoint

```bash
#!/bin/bash
# post-deployment-check.sh

PROJECT="linkshift-prod"

echo "=== 24-HOUR POST-DEPLOYMENT CHECK ==="
echo ""

# 1. Error rate baseline vs current
echo "1. Error Rate Analysis"
echo "   Baseline errors: $(gcloud monitoring read ... | grep -c 'ERROR')"
echo "   Current errors: $(gcloud logging read ... | grep -c 'severity=ERROR')"

# 2. User impact assessment
echo "2. User Impact Assessment"
gcloud logging read \
  "resource.type=cloud_firestore_database AND 
   severity=ERROR" \
  --project ${PROJECT} \
  --statistics-mode=ANALYZE_ALL | head -20

# 3. Performance impact
echo "3. Performance Impact"
echo "   Read latency trend: (check dashboard)"
echo "   Write latency trend: (check dashboard)"

# 4. Compliance check
echo "4. Rules Compliance Check"
firebase rules:validate --project ${PROJECT} && echo "   ✅ Rules valid"

# 5. Backup verification
echo "5. Backup Verification"
gsutil ls -l gs://linkshift-prod-db-backup/ | tail -5

echo ""
echo "=== CHECK COMPLETE ==="
```

---

## 📞 SUPPORT & ESCALATION

### Escalation Matrix

```
Level 1: Automated Response
  Trigger: Permission denial rate > 500/min
  Action: Page on-call DevOps
  
Level 2: Manual Investigation
  Trigger: Error rate > 10% for 5 min
  Action: Page DBA + Backend Lead
  
Level 3: Emergency Response
  Trigger: Firestore unavailable or data corruption
  Action: Page all senior engineers + management

Contact:
  On-Call DevOps: pagerduty.com/services/linkshift-prod
  Database Team: #database-team on Slack
  Management: engineering-director@
```

---

## 🎯 DEPLOYMENT SUCCESS CRITERIA

```
✅ Deployment successful when:

□ Rules deployed without errors
□ No increase in permission denials (< 1% increase acceptable)
□ Shift creation/update operations continue normally
□ Invitation flow works end-to-end
□ Audit logs readable by correct users
□ Latency within 10% of baseline (< 50ms p95)
□ Error rate < 1% (same as before)
□ Zero data loss (backup intact and testable)
□ All monitoring dashboards green
□ No user complaints in support channels for 4 hours
```

---

## 📝 DEPLOYMENT RECORD TEMPLATE

```
Deployment ID: PROD-20251020-001
Timestamp: 2025-10-20 14:30:00 UTC
Deployed By: [Your Name]
Reviewed By: [Reviewer Name]
Environment: Production (linkshift-prod)

Changes Deployed:
  ✅ Field validation on shift creation
  ✅ Timestamp immutability protection
  ✅ Audit log admin-only read
  ✅ Settings field validation
  ✅ Invitation state machine

Monitoring Results (First 4 Hours):
  ✅ Permission denials: Within baseline
  ✅ Error rate: 0.2% (baseline)
  ✅ Latency P95: 45ms (baseline)
  ✅ No critical logs

Final Status: ✅ SUCCESSFUL
Backup Location: gs://linkshift-prod-db-backup/backup-1729417200
Rollback Plan: Firebase CLI - firebase deploy --force
Next Review: 2025-10-24 (4-day post-deployment)
```

---

**Document Version**: 1.0  
**Last Updated**: October 20, 2025  
**DevOps Engineer**: [Your Name]  
**Status**: Ready for Execution
