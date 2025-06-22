#!/bin/bash
set -e

# Configuration
AWS_REGION=us-west-1
TARGET_GROUP_NAME=bosar-api-tg
ALB_NAME=bosar-api-alb

echo "🔄 Updating ALB configuration for WebSocket sticky sessions..."

# Get Target Group ARN
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
    --names $TARGET_GROUP_NAME \
    --region $AWS_REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

if [ "$TARGET_GROUP_ARN" == "None" ] || [ -z "$TARGET_GROUP_ARN" ]; then
    echo "❌ Target group $TARGET_GROUP_NAME not found"
    exit 1
fi

echo "🎯 Target Group ARN: $TARGET_GROUP_ARN"

# Enable sticky sessions for WebSocket connections
echo "🔗 Enabling sticky sessions for WebSocket support..."
aws elbv2 modify-target-group-attributes \
    --target-group-arn $TARGET_GROUP_ARN \
    --attributes \
        Key=stickiness.enabled,Value=true \
        Key=stickiness.type,Value=lb_cookie \
        Key=stickiness.lb_cookie.duration_seconds,Value=86400 \
        Key=load_balancing.algorithm.type,Value=least_outstanding_requests \
        Key=deregistration_delay.timeout_seconds,Value=30 \
    --region $AWS_REGION

echo "✅ Sticky sessions enabled successfully!"

# Update health check settings for better WebSocket support
echo "🏥 Updating health check settings..."
aws elbv2 modify-target-group \
    --target-group-arn $TARGET_GROUP_ARN \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --health-check-path /api \
    --region $AWS_REGION

echo "✅ Health check settings updated!"

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names $ALB_NAME \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

echo "🔄 ALB ARN: $ALB_ARN"

# Check if we need to add WebSocket-specific listener rules
HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn $ALB_ARN \
    --region $AWS_REGION \
    --query 'Listeners[?Port==`443`].ListenerArn' \
    --output text)

echo "🔒 HTTPS Listener ARN: $HTTPS_LISTENER_ARN"

# Display current configuration
echo ""
echo "📋 Current Target Group Configuration:"
aws elbv2 describe-target-group-attributes \
    --target-group-arn $TARGET_GROUP_ARN \
    --region $AWS_REGION \
    --query 'Attributes[?Key==`stickiness.enabled` || Key==`stickiness.type` || Key==`stickiness.lb_cookie.duration_seconds` || Key==`load_balancing.algorithm.type`]' \
    --output table

echo ""
echo "🎉 ALB WebSocket configuration completed!"
echo ""
echo "📋 Summary of changes:"
echo "   ✅ Sticky sessions enabled with lb_cookie"
echo "   ✅ Cookie duration set to 24 hours (86400 seconds)"
echo "   ✅ Load balancing algorithm set to least_outstanding_requests"
echo "   ✅ Deregistration delay reduced to 30 seconds"
echo "   ✅ Health check settings optimized"
echo ""
echo "⚠️  Note: These changes will help maintain WebSocket connections to the same backend instance."
echo "⚠️  The application also includes heartbeat monitoring for additional connection reliability."
