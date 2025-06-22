# WebSocket Sticky Sessions with AWS Fargate and ALB

This document explains the implementation of long-lived sticky WebSocket connections for the BoSar API using AWS Fargate and Application Load Balancer (ALB).

## Overview

The chat application requires persistent WebSocket connections between the frontend and backend to maintain real-time communication. With AWS Fargate and ALB, we need to ensure that WebSocket connections are "sticky" - meaning they stay connected to the same backend instance throughout the session.

## Architecture Components

### 1. **Application Load Balancer (ALB)**
- **Sticky Sessions**: Enabled with `lb_cookie` type
- **Cookie Duration**: 24 hours (86400 seconds)
- **Load Balancing Algorithm**: `least_outstanding_requests`
- **Deregistration Delay**: 30 seconds (reduced for faster failover)

### 2. **WebSocket Gateway (NestJS)**
- **Namespace**: `/chat`
- **Ping Timeout**: 60 seconds
- **Ping Interval**: 25 seconds
- **Heartbeat Monitoring**: 30-second intervals
- **Connection Tracking**: In-memory client registry

### 3. **Client-Side (Socket.IO)**
- **Transports**: WebSocket with polling fallback
- **Credentials**: Enabled for sticky session cookies
- **Heartbeat Response**: Automatic server heartbeat acknowledgment
- **Reconnection**: Custom logic with exponential backoff

## Implementation Details

### ALB Configuration

The ALB is configured with sticky sessions to ensure WebSocket connections remain on the same backend:

```bash
# Enable sticky sessions
aws elbv2 modify-target-group-attributes \
    --target-group-arn $TARGET_GROUP_ARN \
    --attributes \
        Key=stickiness.enabled,Value=true \
        Key=stickiness.type,Value=lb_cookie \
        Key=stickiness.lb_cookie.duration_seconds,Value=86400 \
        Key=load_balancing.algorithm.type,Value=least_outstanding_requests
```

### Server-Side Heartbeat

The WebSocket gateway implements heartbeat monitoring:

```typescript
// Send heartbeat every 30 seconds
setInterval(() => {
  this.connectedClients.forEach((client, clientId) => {
    if (client.connected) {
      client.emit('heartbeat', { timestamp: Date.now() });
    }
  });
}, 30000);
```

### Client-Side Configuration

The Socket.IO client is configured for sticky sessions:

```typescript
const socket = io(wsUrl, {
  transports: ['websocket', 'polling'],
  withCredentials: true, // Important for sticky sessions
  upgrade: true,
  rememberUpgrade: true,
});
```

## Health Monitoring

### WebSocket Health Check Endpoint

A dedicated health check endpoint provides WebSocket service status:

```
GET /health/websocket
```

Response:
```json
{
  "status": "healthy",
  "websocket": "available",
  "endpoint": "/chat",
  "features": {
    "heartbeat": true,
    "stickySession": true,
    "authentication": true,
    "widgetSupport": true,
    "reconnection": true
  }
}
```

### Connection Monitoring

- **Server-side**: Tracks active connections and removes stale ones
- **Client-side**: Responds to heartbeats and handles connection loss
- **Automatic Reconnection**: Custom logic with fallback mechanisms

## Deployment Steps

### 1. Update ALB Configuration

Run the ALB update script:
```bash
./update-alb-for-websockets.sh
```

### 2. Deploy Updated Application

Deploy with the enhanced WebSocket configuration:
```bash
./deploy-to-ecs.sh
```

### 3. Verify Sticky Sessions

Check that sticky sessions are enabled:
```bash
aws elbv2 describe-target-group-attributes \
    --target-group-arn $TARGET_GROUP_ARN \
    --query 'Attributes[?Key==`stickiness.enabled`]'
```

## Environment Variables

The following environment variables control WebSocket behavior:

- `WEBSOCKET_PING_TIMEOUT`: 60000ms (server ping timeout)
- `WEBSOCKET_PING_INTERVAL`: 25000ms (server ping interval)
- `WEBSOCKET_HEARTBEAT_INTERVAL`: 30000ms (heartbeat monitoring interval)

## Testing WebSocket Connections

### 1. Connection Test

```javascript
const socket = io('wss://api.bosar.click/chat', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => {
  console.log('Connected with sticky session');
});
```

### 2. Heartbeat Verification

Monitor browser console for heartbeat logs:
```
🔌 Connection attempt 1/2 to WebSocket: wss://api.bosar.click/chat
✅ Connected to chat server successfully (authenticated mode)
```

### 3. Load Balancer Cookie

Check browser developer tools for ALB cookie:
- Cookie name: `AWSALB` or `AWSALBCORS`
- Duration: 24 hours
- Secure: true (for HTTPS)

## Troubleshooting

### Connection Drops

1. **Check ALB sticky sessions**: Verify configuration
2. **Monitor heartbeats**: Look for timeout warnings
3. **Review logs**: Check CloudWatch for connection errors

### Performance Issues

1. **Connection count**: Monitor active WebSocket connections
2. **Memory usage**: Track client registry size
3. **Network latency**: Verify ping/pong timing

### Failover Scenarios

1. **Instance replacement**: Sticky sessions help during rolling updates
2. **Health check failures**: Connections gracefully move to healthy instances
3. **Network issues**: Client-side reconnection handles temporary outages

## Benefits

- **Persistent Connections**: Long-lived WebSocket sessions
- **Load Distribution**: Efficient connection distribution across instances
- **Fault Tolerance**: Automatic failover and reconnection
- **Monitoring**: Comprehensive health checks and logging
- **Scalability**: Supports multiple ECS instances behind ALB

## Security Considerations

- **Authentication**: JWT token validation for secure connections
- **CORS**: Properly configured for cross-origin requests
- **SSL/TLS**: All connections encrypted in transit
- **Rate Limiting**: Built-in Socket.IO protection mechanisms
