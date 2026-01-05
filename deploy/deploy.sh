#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="zigscan-api"
BACKUP_CONTAINER_NAME="zigscan-api-old"
MAX_WAIT_TIME=60
HEALTH_CHECK_URL="http://localhost:8000/"

echo -e "${GREEN}=== ZigScan API Deployment Script ===${NC}"

# Function to check if container is healthy
check_health() {
    local container=$1
    local max_attempts=12
    local attempt=0
    
    echo "Checking health of $container..."
    
    while [ $attempt -lt $max_attempts ]; do
        # Try using curl from host first, fallback to wget inside container
        if curl -f -s -o /dev/null $HEALTH_CHECK_URL 2>/dev/null; then
            echo -e "${GREEN}✓ Container $container is healthy${NC}"
            return 0
        elif docker exec $container wget --no-verbose --tries=1 --spider $HEALTH_CHECK_URL 2>/dev/null; then
            echo -e "${GREEN}✓ Container $container is healthy${NC}"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "Waiting for container to be healthy... ($attempt/$max_attempts)"
        sleep 5
    done
    
    echo -e "${RED}✗ Container $container failed health check${NC}"
    return 1
}

# Function to rollback
rollback() {
    echo -e "${YELLOW}Rolling back to previous version...${NC}"
    
    # Stop and remove the failed new container
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    
    # Restore the old container
    if docker ps -a --format '{{.Names}}' | grep -q "^${BACKUP_CONTAINER_NAME}$"; then
        docker rename $BACKUP_CONTAINER_NAME $CONTAINER_NAME
        docker start $CONTAINER_NAME
        echo -e "${GREEN}✓ Rollback complete${NC}"
    else
        echo -e "${RED}✗ No backup container found for rollback${NC}"
        exit 1
    fi
}

# Step 1: Pull new image
echo "Step 1: Pulling new Docker image..."
export IMAGE_NAME="${IMAGE_NAME}"
docker compose pull
echo -e "${GREEN}✓ Image pulled successfully${NC}"

# Step 2: Check if old container exists
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Step 2: Backing up current container..."
    
    # Rename old container as backup
    docker rename $CONTAINER_NAME $BACKUP_CONTAINER_NAME 2>/dev/null || true
    echo -e "${GREEN}✓ Current container backed up${NC}"
else
    echo "Step 2: No existing container to backup"
fi

# Step 3: Start new container
echo "Step 3: Starting new container..."
docker compose up -d --force-recreate

# Step 4: Wait for new container to be healthy
echo "Step 4: Waiting for new container to be healthy..."
if check_health $CONTAINER_NAME; then
    echo -e "${GREEN}✓ New container is healthy and running${NC}"
    
    # Step 5: Remove old backup container
    if docker ps -a --format '{{.Names}}' | grep -q "^${BACKUP_CONTAINER_NAME}$"; then
        echo "Step 5: Removing old backup container..."
        docker stop $BACKUP_CONTAINER_NAME 2>/dev/null || true
        docker rm $BACKUP_CONTAINER_NAME 2>/dev/null || true
        echo -e "${GREEN}✓ Old container removed${NC}"
    fi
    
    # Step 6: Cleanup old images
    echo "Step 6: Cleaning up old images..."
    docker image prune -f
    echo -e "${GREEN}✓ Old images cleaned up${NC}"
    
    echo -e "${GREEN}=== Deployment completed successfully ===${NC}"
    
    # Show final status
    echo ""
    echo "Container status:"
    docker ps --filter "name=$CONTAINER_NAME"
    
    echo ""
    echo "Recent logs:"
    docker logs $CONTAINER_NAME --tail 20
    
else
    echo -e "${RED}✗ New container failed health check${NC}"
    
    # Show logs for debugging
    echo ""
    echo "Failed container logs:"
    docker logs $CONTAINER_NAME --tail 50
    
    # Rollback
    rollback
    
    echo -e "${RED}=== Deployment failed and rolled back ===${NC}"
    exit 1
fi
