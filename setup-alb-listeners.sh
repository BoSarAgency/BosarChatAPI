#!/bin/bash
set -e

# Configuration
AWS_REGION=us-west-1
DOMAIN_NAME=api.bosar.click
ROOT_DOMAIN=bosar.click

echo "🔄 Setting up ALB Listeners and Route 53 record..."

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names bosar-api-alb \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

# Get Target Group ARN
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
    --names bosar-api-tg \
    --region $AWS_REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# Get Certificate ARN
CERT_ARN=$(aws acm list-certificates \
    --region $AWS_REGION \
    --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
    --output text)

# Get ALB DNS Name
ALB_DNS_NAME=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

# Get ALB Hosted Zone ID
ALB_HOSTED_ZONE_ID=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].CanonicalHostedZoneId' \
    --output text)

echo "🔄 ALB ARN: $ALB_ARN"
echo "🎯 Target Group ARN: $TARGET_GROUP_ARN"
echo "🔐 Certificate ARN: $CERT_ARN"
echo "🌐 ALB DNS Name: $ALB_DNS_NAME"
echo "🌐 ALB Hosted Zone ID: $ALB_HOSTED_ZONE_ID"

# Create HTTP Listener (redirect to HTTPS)
echo "🔄 Creating HTTP Listener (redirect to HTTPS)..."
HTTP_LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
    --region $AWS_REGION \
    --query 'Listeners[0].ListenerArn' \
    --output text 2>/dev/null || \
    aws elbv2 describe-listeners \
        --load-balancer-arn $ALB_ARN \
        --region $AWS_REGION \
        --query 'Listeners[?Port==`80`].ListenerArn' \
        --output text)

echo "🔄 HTTP Listener ARN: $HTTP_LISTENER_ARN"

# Create HTTPS Listener
echo "🔒 Creating HTTPS Listener..."
HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=$CERT_ARN \
    --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
    --region $AWS_REGION \
    --query 'Listeners[0].ListenerArn' \
    --output text 2>/dev/null || \
    aws elbv2 describe-listeners \
        --load-balancer-arn $ALB_ARN \
        --region $AWS_REGION \
        --query 'Listeners[?Port==`443`].ListenerArn' \
        --output text)

echo "🔒 HTTPS Listener ARN: $HTTPS_LISTENER_ARN"

# Get Route 53 Hosted Zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='$ROOT_DOMAIN.'].Id" \
    --output text | sed 's|/hostedzone/||')

echo "🌐 Route 53 Hosted Zone ID: $HOSTED_ZONE_ID"

# Create Route 53 A record
echo "📝 Creating Route 53 A record for $DOMAIN_NAME..."
cat > route53-record.json << EOF
{
    "Comment": "A record for $DOMAIN_NAME pointing to ALB",
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$DOMAIN_NAME",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "$ALB_DNS_NAME",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "$ALB_HOSTED_ZONE_ID"
                }
            }
        }
    ]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch file://route53-record.json

echo "✅ Route 53 A record created successfully!"

# Clean up temporary file
rm -f route53-record.json

echo "🎉 ALB Listeners and Route 53 setup completed!"
echo ""
echo "📋 Summary:"
echo "   HTTP Listener (redirect): $HTTP_LISTENER_ARN"
echo "   HTTPS Listener: $HTTPS_LISTENER_ARN"
echo "   Domain: https://$DOMAIN_NAME"
echo ""
echo "⚠️  The domain should be accessible in a few minutes after DNS propagation."
