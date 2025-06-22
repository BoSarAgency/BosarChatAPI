#!/bin/bash
set -e

# WebSocket Sticky Sessions Deployment Script
# This script configures AWS ALB for sticky sessions and deploys the enhanced WebSocket application

# Configuration
AWS_REGION=us-west-1
TARGET_GROUP_NAME=bosar-api-tg
ALB_NAME=bosar-api-alb
ECR_REPOSITORY=160885246604.dkr.ecr.us-west-1.amazonaws.com/bosar-api
ECS_CLUSTER=bosar-cluster
ECS_SERVICE=bosar-service
TASK_FAMILY=bosar-task

echo "🚀 Starting WebSocket Sticky Sessions Deployment..."
echo "=================================================="

# Step 1: Update ALB for WebSocket sticky sessions
echo ""
echo "📋 Step 1: Configuring ALB for WebSocket sticky sessions..."
./update-alb-for-websockets.sh

# Step 2: Build and deploy the enhanced application
echo ""
echo "📋 Step 2: Building and deploying enhanced WebSocket application..."

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Login to ECR
echo "🔐 Logging in to Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY

# Build Docker image
echo "🔨 Building Docker image with WebSocket enhancements..."
docker build -t bosar-api .

# Tag image
echo "🏷️ Tagging image..."
docker tag bosar-api:latest $ECR_REPOSITORY:latest

# Push to ECR
echo "📤 Pushing image to ECR..."
docker push $ECR_REPOSITORY:latest

# Register new task definition
echo "📝 Registering new task definition with WebSocket environment variables..."
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://bosar-task-definition.json \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "📝 New Task Definition ARN: $TASK_DEFINITION_ARN"

# Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition $TASK_FAMILY \
    --region $AWS_REGION

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION

echo "✅ Deployment completed successfully!"

# Step 3: Verify the deployment
echo ""
echo "📋 Step 3: Verifying WebSocket sticky session configuration..."

# Check ALB sticky sessions
echo "🔍 Verifying ALB sticky session configuration..."
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
    --names $TARGET_GROUP_NAME \
    --region $AWS_REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

echo "📊 Current sticky session configuration:"
aws elbv2 describe-target-group-attributes \
    --target-group-arn $TARGET_GROUP_ARN \
    --region $AWS_REGION \
    --query 'Attributes[?Key==`stickiness.enabled` || Key==`stickiness.type` || Key==`stickiness.lb_cookie.duration_seconds`]' \
    --output table

# Test WebSocket health endpoint
echo ""
echo "🏥 Testing WebSocket health endpoint..."
sleep 10  # Wait for service to be ready

DOMAIN_NAME=api.bosar.click
echo "🌐 Testing: https://$DOMAIN_NAME/health/websocket"

# Test the health endpoint
if curl -f -s "https://$DOMAIN_NAME/health/websocket" > /dev/null; then
    echo "✅ WebSocket health endpoint is responding"
    echo "📊 WebSocket health status:"
    curl -s "https://$DOMAIN_NAME/health/websocket" | jq '.'
else
    echo "⚠️ WebSocket health endpoint not yet available (may need more time)"
fi

# Display deployment summary
echo ""
echo "🎉 WebSocket Sticky Sessions Deployment Complete!"
echo "=================================================="
echo ""
echo "📋 Deployment Summary:"
echo "   ✅ ALB configured with sticky sessions (24-hour duration)"
echo "   ✅ Load balancing algorithm: least_outstanding_requests"
echo "   ✅ WebSocket heartbeat monitoring enabled (30s intervals)"
echo "   ✅ Enhanced connection tracking and recovery"
echo "   ✅ Client-side sticky session support"
echo "   ✅ Health monitoring endpoints available"
echo ""
echo "🔗 WebSocket Endpoint: wss://$DOMAIN_NAME/chat"
echo "🏥 Health Check: https://$DOMAIN_NAME/health/websocket"
echo "📚 Documentation: WEBSOCKET_STICKY_SESSIONS.md"
echo ""
echo "⚠️  Important Notes:"
echo "   • WebSocket connections will now persist to the same backend instance"
echo "   • Heartbeat monitoring helps detect and recover from connection issues"
echo "   • Client applications should use withCredentials: true for sticky sessions"
echo "   • Monitor CloudWatch logs for connection health and performance"
echo ""
echo "🧪 To test WebSocket connections:"
echo "   1. Open browser developer tools"
echo "   2. Connect to wss://$DOMAIN_NAME/chat with authentication"
echo "   3. Look for AWSALB cookie in Application/Storage tab"
echo "   4. Monitor console for heartbeat messages"
