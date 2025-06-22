#!/bin/bash
set -e

# Configuration
ECR_REPOSITORY=160885246604.dkr.ecr.us-west-1.amazonaws.com/bosar-api
AWS_REGION=us-west-1
ECS_CLUSTER=bosar-cluster
ECS_SERVICE=bosar-service
TASK_FAMILY=bosar-task

echo "🚀 Starting deployment of BoSar API to ECS..."

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Login to ECR
echo "🔐 Logging in to Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY

# Build and tag the Docker image for AMD64 platform (required for AWS ECS)
echo "🏗️  Building and tagging Docker image for AMD64 platform..."
docker build --platform linux/amd64 -t bosar-api:latest .
docker tag bosar-api:latest $ECR_REPOSITORY:latest

# Push the Docker image to ECR
echo "📤 Pushing Docker image to ECR..."
docker push $ECR_REPOSITORY:latest

# Run database migrations
echo "🗃️  Running database migrations..."
# Note: Make sure DATABASE_URL is set in your environment or AWS Parameter Store
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -n "$DATABASE_URL" ]; then
    echo "Running Prisma migrations..."
    npx prisma migrate deploy
else
    echo "⚠️  DATABASE_URL not found. Skipping migrations. Make sure to run them manually."
fi

# Register new task definition
echo "📋 Registering new task definition..."
aws ecs register-task-definition --cli-input-json file://bosar-task-definition.json --region $AWS_REGION

# Get infrastructure details
echo "🔍 Getting infrastructure details..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text --region $AWS_REGION)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text --region $AWS_REGION)
SUBNET_ARRAY=($SUBNET_IDS)
ECS_SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=bosar-ecs-sg" "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[0].GroupId' --output text --region $AWS_REGION)
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --names bosar-api-tg --region $AWS_REGION --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "📋 VPC ID: $VPC_ID"
echo "📋 Subnets: ${SUBNET_ARRAY[@]}"
echo "📋 ECS Security Group: $ECS_SG_ID"
echo "📋 Target Group ARN: $TARGET_GROUP_ARN"

# Check if service exists, if not create it
echo "🔍 Checking if ECS service exists..."
if aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION --query 'services[0].serviceName' --output text 2>/dev/null | grep -q $ECS_SERVICE; then
    echo "📝 Updating existing ECS service..."
    aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --task-definition $TASK_FAMILY --force-new-deployment --region $AWS_REGION
else
    echo "🆕 Creating new ECS service..."
    aws ecs create-service \
        --cluster $ECS_CLUSTER \
        --service-name $ECS_SERVICE \
        --task-definition $TASK_FAMILY \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_ARRAY[0]},${SUBNET_ARRAY[1]}],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=bosar-api,containerPort=3001" \
        --region $AWS_REGION

fi

echo "✅ Deployment completed successfully!"
echo "🌐 Your BoSar API should be available at: https://api.bosar.click"
echo "📊 You can monitor the deployment in the AWS ECS console."
echo "🔍 Check the health of your service:"
echo "   - ECS Service: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$ECS_CLUSTER/services"
echo "   - Target Group: https://console.aws.amazon.com/ec2/v2/home?region=$AWS_REGION#TargetGroups:"
echo "   - Load Balancer: https://console.aws.amazon.com/ec2/v2/home?region=$AWS_REGION#LoadBalancers:"
