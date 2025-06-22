#!/bin/bash
set -e

# Configuration
AWS_REGION=us-west-1
ECS_CLUSTER=bosar-cluster
ECS_SERVICE=bosar-service
TASK_FAMILY=bosar-task
DOMAIN_NAME=api.bosar.click
ROOT_DOMAIN=bosar.click

echo "🚀 Setting up AWS Infrastructure for BoSar API..."

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }

# Get VPC and subnet information
echo "🔍 Getting VPC and subnet information..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text --region $AWS_REGION)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text --region $AWS_REGION)
SUBNET_ARRAY=($SUBNET_IDS)

echo "📋 VPC ID: $VPC_ID"
echo "📋 Subnets: ${SUBNET_ARRAY[@]}"

# Create CloudWatch Log Group
echo "📊 Creating CloudWatch Log Group..."
aws logs create-log-group --log-group-name "/ecs/bosar-task" --region $AWS_REGION 2>/dev/null || echo "Log group already exists"

# Create Security Group for ALB
echo "🔒 Creating Security Group for Application Load Balancer..."
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name bosar-alb-sg \
    --description "Security group for BoSar API ALB" \
    --vpc-id $VPC_ID \
    --region $AWS_REGION \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=bosar-alb-sg" "Name=vpc-id,Values=$VPC_ID" \
        --query 'SecurityGroups[0].GroupId' \
        --output text \
        --region $AWS_REGION)

echo "🔒 ALB Security Group ID: $ALB_SG_ID"

# Add rules to ALB Security Group
aws ec2 authorize-security-group-ingress \
    --group-id $ALB_SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION 2>/dev/null || echo "HTTP rule already exists"

aws ec2 authorize-security-group-ingress \
    --group-id $ALB_SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION 2>/dev/null || echo "HTTPS rule already exists"

# Create Security Group for ECS Service
echo "🔒 Creating Security Group for ECS Service..."
ECS_SG_ID=$(aws ec2 create-security-group \
    --group-name bosar-ecs-sg \
    --description "Security group for BoSar API ECS Service" \
    --vpc-id $VPC_ID \
    --region $AWS_REGION \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=bosar-ecs-sg" "Name=vpc-id,Values=$VPC_ID" \
        --query 'SecurityGroups[0].GroupId' \
        --output text \
        --region $AWS_REGION)

echo "🔒 ECS Security Group ID: $ECS_SG_ID"

# Add rule to ECS Security Group to allow traffic from ALB
aws ec2 authorize-security-group-ingress \
    --group-id $ECS_SG_ID \
    --protocol tcp \
    --port 3001 \
    --source-group $ALB_SG_ID \
    --region $AWS_REGION 2>/dev/null || echo "ECS rule already exists"

# Request SSL Certificate
echo "🔐 Requesting SSL Certificate..."
CERT_ARN=$(aws acm request-certificate \
    --domain-name $DOMAIN_NAME \
    --validation-method DNS \
    --region $AWS_REGION \
    --query 'CertificateArn' \
    --output text 2>/dev/null || \
    aws acm list-certificates \
        --region $AWS_REGION \
        --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
        --output text)

echo "🔐 Certificate ARN: $CERT_ARN"

# Get Route 53 Hosted Zone ID
echo "🌐 Getting Route 53 Hosted Zone ID..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='$ROOT_DOMAIN.'].Id" \
    --output text | sed 's|/hostedzone/||')

echo "🌐 Hosted Zone ID: $HOSTED_ZONE_ID"

# Create Application Load Balancer
echo "🔄 Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name bosar-api-alb \
    --subnets ${SUBNET_ARRAY[@]} \
    --security-groups $ALB_SG_ID \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null || \
    aws elbv2 describe-load-balancers \
        --names bosar-api-alb \
        --region $AWS_REGION \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)

echo "🔄 ALB ARN: $ALB_ARN"

# Get ALB DNS Name
ALB_DNS_NAME=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

echo "🔄 ALB DNS Name: $ALB_DNS_NAME"

# Create Target Group with sticky sessions for WebSocket support
echo "🎯 Creating Target Group with WebSocket sticky session support..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name bosar-api-tg \
    --protocol HTTP \
    --port 3001 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path /api \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region $AWS_REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null || \
    aws elbv2 describe-target-groups \
        --names bosar-api-tg \
        --region $AWS_REGION \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)

echo "🎯 Target Group ARN: $TARGET_GROUP_ARN"

# Enable sticky sessions for WebSocket connections
echo "🔗 Enabling sticky sessions for WebSocket support..."
aws elbv2 modify-target-group-attributes \
    --target-group-arn $TARGET_GROUP_ARN \
    --attributes Key=stickiness.enabled,Value=true \
                Key=stickiness.type,Value=lb_cookie \
                Key=stickiness.lb_cookie.duration_seconds,Value=86400 \
                Key=load_balancing.algorithm.type,Value=least_outstanding_requests \
    --region $AWS_REGION 2>/dev/null || echo "Sticky sessions already configured"

echo "🎯 Target Group ARN: $TARGET_GROUP_ARN"

echo "✅ AWS Infrastructure setup completed!"
echo ""
echo "📋 Summary:"
echo "   VPC ID: $VPC_ID"
echo "   ALB Security Group: $ALB_SG_ID"
echo "   ECS Security Group: $ECS_SG_ID"
echo "   Certificate ARN: $CERT_ARN"
echo "   ALB ARN: $ALB_ARN"
echo "   ALB DNS Name: $ALB_DNS_NAME"
echo "   Target Group ARN: $TARGET_GROUP_ARN"
echo "   Hosted Zone ID: $HOSTED_ZONE_ID"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Validate the SSL certificate by adding the DNS record to Route 53"
echo "2. Run the certificate validation script: ./validate-certificate.sh"
echo "3. Run the deployment script: ./deploy-to-ecs.sh"
