# Docker Deployment Strategy

## Overview
TKO MCP server packaged as a lightweight Docker container with SQLite persistence mapped to the host filesystem.

## Dockerfile Design

### Multi-Stage Build
Use multi-stage build for smaller final image size:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create data directory
RUN mkdir -p /data && chown node:node /data

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/build ./build

# Use non-root user
USER node

# Expose SSE port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["node", "build/index.js"]
```

### Image Characteristics
- **Base:** node:20-alpine (~40MB base)
- **Final Size:** ~80-100MB
- **Startup Time:** < 2 seconds
- **User:** Non-root (node user)
- **Signal Handling:** dumb-init for proper SIGTERM

## Docker Compose Configuration

### Single Instance Setup

```yaml
version: '3.8'

services:
  tko:
    image: tko-mcp:latest
    container_name: tko-mcp
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      # Persistent database storage
      - ./data:/data
      # Optional: Custom configuration
      - ./config:/config:ro
    environment:
      # Server mode / transport
      TKO_MODE: both  # Stdio + Streamable HTTP
      TKO_ENABLE_SSE: "false"  # Set true only for legacy SSE

      # HTTP configuration
      TKO_PORT: 3000
      TKO_HOST: 0.0.0.0

      # Database
      TKO_DB_PATH: /data/tinytask.db

      # Optional features
      TKO_ENABLE_HISTORY: "false"
      TKO_LOG_LEVEL: info

      # Node environment
      NODE_ENV: production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    networks:
      - tko-network

networks:
  tko-network:
    driver: bridge
```

### Development Setup with Hot Reload

```yaml
version: '3.8'

services:
  tko-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: tko-mcp-dev
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port
    volumes:
      - ./src:/app/src:ro
      - ./data:/data
      - /app/node_modules  # Prevent overwriting
    environment:
      TKO_MODE: both
      TKO_ENABLE_SSE: "false"
      TKO_PORT: 3000
      TKO_DB_PATH: /data/tinytask.db
      TKO_LOG_LEVEL: debug
      NODE_ENV: development
    command: npm run dev
    networks:
      - tko-network

networks:
  tko-network:
    driver: bridge
```

## Volume Management

### Data Volume Strategy

**Option 1: Host Directory (Recommended for MVP)**
```bash
# Create data directory on host
mkdir -p /opt/tko/data

# Set permissions
chmod 755 /opt/tko/data

# Mount in container
docker run -v /opt/tko/data:/data tko-mcp
```

**Advantages:**
- Easy to backup (just copy directory)
- Easy to inspect database file
- Works across container restarts
- Simple migration

**Option 2: Named Docker Volume**
```bash
# Create volume
docker volume create tko-data

# Mount in container
docker run -v tko-data:/data tko-mcp

# Backup volume
docker run --rm -v tko-data:/data -v $(pwd):/backup alpine tar czf /backup/tko-backup.tar.gz /data
```

**Advantages:**
- Managed by Docker
- Better performance on some systems
- Portable across hosts with volume plugins

### Recommended: Host Directory
For MVP, use host directory for simplicity and easy access.

## Persistence Across Restarts

### SQLite Configuration for Containers

1. **WAL Mode:** Write-Ahead Logging for better concurrency
   ```sql
   PRAGMA journal_mode=WAL;
   ```

2. **Synchronous Mode:** Balance between safety and performance
   ```sql
   PRAGMA synchronous=NORMAL;
   ```

3. **Auto Vacuum:** Keep database file size reasonable
   ```sql
   PRAGMA auto_vacuum=INCREMENTAL;
   ```

### Backup Strategy

**Automated Backup Script** (run on host via cron):

```bash
#!/bin/bash
# backup-tko.sh

BACKUP_DIR="/opt/tko/backups"
DB_PATH="/opt/tko/data/tinytask.db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup using SQLite online backup
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/tko-$TIMESTAMP.db'"

# Compress
gzip "$BACKUP_DIR/tko-$TIMESTAMP.db"

# Keep only last 7 days
find "$BACKUP_DIR" -name "tko-*.db.gz" -mtime +7 -delete

echo "Backup completed: tko-$TIMESTAMP.db.gz"
```

**Crontab entry** (daily at 2 AM):
```cron
0 2 * * * /opt/tko/backup-tko.sh >> /var/log/tko-backup.log 2>&1
```

## Container Orchestration

### Standalone Docker

```bash
# Build image
docker build -t tko-mcp:latest .

# Run container
docker run -d \
  --name tko-mcp \
  -p 3000:3000 \
  -v /opt/tko/data:/data \
  -e TKO_MODE=sse \
  -e TKO_LOG_LEVEL=info \
  --restart unless-stopped \
  tko-mcp:latest

# View logs
docker logs -f tko-mcp

# Stop container
docker stop tko-mcp

# Start container
docker start tko-mcp

# Remove container (data persists in volume)
docker rm tko-mcp
```

### Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Stop and remove volumes (DANGER: deletes data)
docker-compose down -v
```

## Network Configuration

### Port Mapping
- **Container Port:** 3000 (configurable via TKO_PORT)
- **Host Port:** 3000 (can map to any available port)

### Firewall Rules
If running on a server:
```bash
# Allow incoming connections on port 3000
sudo ufw allow 3000/tcp

# Or restrict to specific IP range (e.g., internal network)
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

### Reverse Proxy (Optional)
For production, consider nginx or traefik:

```nginx
# nginx configuration
upstream tko {
    server localhost:3000;
}

server {
    listen 80;
    server_name tko.example.com;

    location /mcp {
        proxy_pass http://tko;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE specific
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /health {
        proxy_pass http://tko;
    }
}
```

## Monitoring and Health Checks

### Health Check Endpoint

The server exposes `/health` endpoint:

```typescript
// Returns:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",
  "uptime": 3600
}
```

### Docker Health Check
Built into Dockerfile:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
```

### External Monitoring
Can integrate with:
- **Prometheus:** Export metrics
- **Grafana:** Visualize dashboards
- **UptimeRobot:** External availability monitoring

## Logging Strategy

### Container Logs
Docker automatically captures stdout/stderr:

```bash
# View logs
docker logs tko-mcp

# Follow logs
docker logs -f tko-mcp

# Last 100 lines
docker logs --tail 100 tko-mcp

# With timestamps
docker logs -t tko-mcp
```

### Log Levels
Configure via environment variable:
- `debug`: Verbose, includes all SQL queries
- `info`: Normal operations (default)
- `warn`: Warnings only
- `error`: Errors only

### Log Rotation
Configure Docker daemon for log rotation:

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## Security Considerations

### Container Security

1. **Non-root user:** Run as `node` user
2. **Read-only filesystem:** Where possible
3. **No privileged mode:** Standard container
4. **Limited capabilities:** Drop unnecessary capabilities

```bash
docker run \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  --read-only \
  --tmpfs /tmp \
  -v /opt/tko/data:/data \
  tko-mcp
```

### Network Security
- Run on internal network only (no public exposure)
- Use reverse proxy with authentication if external access needed
- Consider VPN for remote agent access

## Resource Limits

### Docker Resource Constraints

```yaml
services:
  tko:
    # ...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

Or with docker run:
```bash
docker run \
  --cpus=1.0 \
  --memory=512m \
  --memory-reservation=256m \
  tko-mcp
```

### Recommended Resources
- **CPU:** 0.5-1.0 cores (sufficient for 10-100 agents)
- **Memory:** 256-512MB
- **Disk:** 1GB (database grows with usage)
- **Network:** 1Mbps (low traffic)

## Deployment Checklist

### Pre-Deployment
- [ ] Build Docker image
- [ ] Create data directory on host
- [ ] Set appropriate permissions
- [ ] Configure environment variables
- [ ] Test locally first

### Deployment
- [ ] Deploy container with volume mount
- [ ] Verify health check passes
- [ ] Test database persistence (restart container)
- [ ] Configure backup script
- [ ] Set up monitoring

### Post-Deployment
- [ ] Test agent connectivity
- [ ] Monitor logs for errors
- [ ] Verify backups are working
- [ ] Document agent connection strings
- [ ] Test disaster recovery procedure

## Disaster Recovery

### Recovery Procedure

1. **Stop container:**
   ```bash
   docker stop tko-mcp
   ```

2. **Restore from backup:**
   ```bash
   cp /opt/tko/backups/tko-20240115-020000.db /opt/tko/data/tinytask.db
   ```

3. **Restart container:**
   ```bash
   docker start tko-mcp
   ```

4. **Verify:**
   ```bash
   docker logs tko-mcp
   curl http://localhost:3000/health
   ```

### Testing Recovery
Test recovery procedure monthly to ensure backups are valid.

## Updating the Container

### Zero-Downtime Update Strategy
1. Deploy new container on different port
2. Migrate data if schema changed
3. Update agent configurations to new endpoint
4. Verify agents working
5. Stop old container

### Simple Update (Brief Downtime)
```bash
# Pull new image
docker pull tko-mcp:latest

# Stop old container
docker stop tko-mcp

# Remove old container
docker rm tko-mcp

# Start new container (uses same volume)
docker run -d \
  --name tko-mcp \
  -p 3000:3000 \
  -v /opt/tko/data:/data \
  --restart unless-stopped \
  tko-mcp:latest

# Verify
docker logs -f tko-mcp
```

## Performance Optimization

### Database Optimization
- **WAL mode:** Already enabled
- **Index maintenance:** ANALYZE after bulk operations
- **Vacuum:** Periodic database defragmentation

### Container Optimization
- **Alpine base:** Smaller image
- **Multi-stage build:** Exclude dev dependencies
- **Layer caching:** Optimize Dockerfile layer order

### Network Optimization
- **Keep-alive:** Reuse connections
- **Compression:** Gzip responses if needed
- **Connection pooling:** For future PostgreSQL upgrade
