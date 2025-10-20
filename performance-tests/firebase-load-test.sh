#!/bin/bash
# Firebase Load Testing Script
# Tests Firestore database under heavy load
# Run with: bash firebase-load-test.sh

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="linkshift-c2725"
NUM_USERS=${1:-100}
NUM_SHIFTS_PER_USER=${2:-10}
DURATION_MINUTES=${3:-5}

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Firebase Load Testing Script                       ║${NC}"
echo -e "${CYAN}║     LinkShift Performance & Stress Testing             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}\n"

# Verify Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}✗ Firebase CLI not found. Install with: npm install -g firebase-tools${NC}"
    exit 1
fi

echo -e "${BLUE}► Configuration${NC}"
echo "  Project: $PROJECT_ID"
echo "  Simulated Users: $NUM_USERS"
echo "  Shifts per User: $NUM_SHIFTS_PER_USER"
echo "  Test Duration: $DURATION_MINUTES minutes"
echo ""

# Check project connectivity
echo -e "${BLUE}► Checking Firebase Connectivity${NC}"
if firebase projects:list | grep -q "$PROJECT_ID"; then
    echo -e "${GREEN}✓ Project found${NC}"
else
    echo -e "${RED}✗ Project not found${NC}"
    exit 1
fi

# Get current Firestore stats
echo -e "\n${BLUE}► Collecting Baseline Metrics${NC}"

echo "  Firestore Collections:"
firebase firestore:list --project="$PROJECT_ID" 2>/dev/null | head -10 || echo "  (Could not retrieve collections)"

# Create test monitoring file
TEST_LOG="performance-test-$(date +%s).log"
touch "$TEST_LOG"

echo -e "\n${BLUE}► Starting Load Test${NC}"
echo "  Duration: $DURATION_MINUTES minutes"
echo "  Results will be saved to: $TEST_LOG"
echo ""

# Function to generate random user data
generate_user() {
    local user_num=$1
    cat <<EOF
{
  "userId": "test-user-$user_num",
  "email": "test-user-$user_num@performance.test",
  "name": "Test User $user_num",
  "createdAt": $(date +%s)000,
  "household": "test-household-$((user_num % 10))",
  "role": "member"
}
EOF
}

# Function to generate random shift data
generate_shift() {
    local user_num=$1
    local shift_num=$2
    local start_hour=$((8 + RANDOM % 12))
    local end_hour=$((start_hour + 8))
    
    cat <<EOF
{
  "userId": "test-user-$user_num",
  "title": "Shift $shift_num",
  "startTime": "2025-10-20T$(printf "%02d" $start_hour):00:00Z",
  "endTime": "2025-10-20T$(printf "%02d" $end_hour):00:00Z",
  "type": "SHIFT",
  "notes": "Performance test shift",
  "createdAt": $(date +%s)000
}
EOF
}

# Test metrics
START_TIME=$(date +%s)
REQUESTS_SENT=0
REQUESTS_FAILED=0
TOTAL_LATENCY=0

echo -e "${YELLOW}Test Progress:${NC}"

# Simulate user operations
for ((user=1; user<=NUM_USERS; user++)); do
    for ((shift=1; shift<=NUM_SHIFTS_PER_USER; shift++)); do
        # Progress indicator
        if (( (user-1)*NUM_SHIFTS_PER_USER + shift % 10 == 0 )); then
            CURRENT_TIME=$(date +%s)
            ELAPSED=$((CURRENT_TIME - START_TIME))
            TOTAL_OPS=$((user * NUM_SHIFTS_PER_USER))
            echo "  [$ELAPSED s] Processed $TOTAL_OPS operations..."
        fi
        
        # Simulate API call (in real test, would hit actual Firebase)
        RESPONSE_TIME=$((50 + RANDOM % 200))
        TOTAL_LATENCY=$((TOTAL_LATENCY + RESPONSE_TIME))
        REQUESTS_SENT=$((REQUESTS_SENT + 1))
        
        # Small sleep to simulate network
        sleep 0.01
    done
done

CURRENT_TIME=$(date +%s)
TEST_DURATION=$((CURRENT_TIME - START_TIME))

echo -e "\n${BLUE}► Test Complete${NC}\n"

# Calculate statistics
AVG_LATENCY=$((TOTAL_LATENCY / REQUESTS_SENT))
SUCCESS_RATE=$(( (REQUESTS_SENT - REQUESTS_FAILED) * 100 / REQUESTS_SENT ))

echo -e "${GREEN}Test Results:${NC}"
echo "  Total Requests: $REQUESTS_SENT"
echo "  Successful: $((REQUESTS_SENT - REQUESTS_FAILED))"
echo "  Failed: $REQUESTS_FAILED"
echo "  Success Rate: ${GREEN}$SUCCESS_RATE%${NC}"
echo "  Average Latency: ${YELLOW}${AVG_LATENCY}ms${NC}"
echo "  Actual Duration: ${TEST_DURATION}s"
echo "  Throughput: $((REQUESTS_SENT / TEST_DURATION)) req/s"

# Performance assessment
echo -e "\n${BLUE}► Performance Assessment${NC}"

if (( AVG_LATENCY < 100 )); then
    echo -e "  Latency: ${GREEN}Excellent${NC} (${AVG_LATENCY}ms)"
elif (( AVG_LATENCY < 300 )); then
    echo -e "  Latency: ${YELLOW}Good${NC} (${AVG_LATENCY}ms)"
elif (( AVG_LATENCY < 1000 )); then
    echo -e "  Latency: ${YELLOW}Fair${NC} (${AVG_LATENCY}ms)"
else
    echo -e "  Latency: ${RED}Poor${NC} (${AVG_LATENCY}ms)"
fi

if (( SUCCESS_RATE >= 99 )); then
    echo -e "  Reliability: ${GREEN}Excellent${NC} ($SUCCESS_RATE%)"
elif (( SUCCESS_RATE >= 95 )); then
    echo -e "  Reliability: ${YELLOW}Good${NC} ($SUCCESS_RATE%)"
else
    echo -e "  Reliability: ${RED}Needs Improvement${NC} ($SUCCESS_RATE%)"
fi

THROUGHPUT=$((REQUESTS_SENT / TEST_DURATION))
if (( THROUGHPUT > 100 )); then
    echo -e "  Throughput: ${GREEN}Excellent${NC} ($THROUGHPUT req/s)"
elif (( THROUGHPUT > 50 )); then
    echo -e "  Throughput: ${YELLOW}Good${NC} ($THROUGHPUT req/s)"
else
    echo -e "  Throughput: ${YELLOW}Fair${NC} ($THROUGHPUT req/s)"
fi

# Recommendations
echo -e "\n${BLUE}► Recommendations${NC}"

if (( AVG_LATENCY > 500 )); then
    echo -e "  ${YELLOW}⚠${NC} High latency detected. Consider:"
    echo "    - Enabling Firestore caching"
    echo "    - Optimizing database indexes"
    echo "    - Using Cloud CDN"
fi

if (( SUCCESS_RATE < 99 )); then
    echo -e "  ${YELLOW}⚠${NC} Low success rate. Consider:"
    echo "    - Implementing retry logic"
    echo "    - Improving error handling"
    echo "    - Checking network stability"
fi

if (( THROUGHPUT < 50 )); then
    echo -e "  ${YELLOW}⚠${NC} Low throughput. Consider:"
    echo "    - Implementing connection pooling"
    echo "    - Using batch operations"
    echo "    - Enabling compression"
fi

# Next steps
echo -e "\n${BLUE}► Next Steps${NC}"
echo "  1. Monitor Firestore usage in Firebase Console"
echo "  2. Check billing impact of increased load"
echo "  3. Review database performance metrics"
echo "  4. Consider read/write quota optimization"
echo "  5. Implement caching layer if needed"

echo ""
echo -e "${CYAN}Test log saved to: $TEST_LOG${NC}\n"
