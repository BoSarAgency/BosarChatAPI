#!/bin/bash
set -e

echo "🔧 Fixing AMD64 architecture issue for AWS ECS deployment"

# Configuration
ECR_REPOSITORY=160885246604.dkr.ecr.us-west-1.amazonaws.com/bosar-api
AWS_REGION=us-west-1
ECS_CLUSTER=bosar-cluster
ECS_SERVICE=bosar-service
TASK_FAMILY=bosar-task

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

echo "🏗️  Current local architecture: $(docker version --format '{{.Client.Arch}}')"
echo "🎯 Target architecture: linux/amd64"

# Login to ECR
echo "🔐 Logging in to Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY

# Ensure we're using the multiarch builder
echo "🔧 Setting up multiarch builder..."
docker buildx use multiarch

# Build specifically for AMD64 and push directly to ECR
echo "🏗️  Building for linux/amd64 and pushing to ECR..."
docker buildx build \
    --platform linux/amd64 \
    --tag $ECR_REPOSITORY:latest \
    --push \
    --progress=plain \
    .

echo "✅ Image built and pushed successfully for AMD64!"

# Verify the image architecture in ECR
echo "🔍 Verifying image architecture in ECR..."
aws ecr describe-images \
    --repository-name bosar-api \
    --region $AWS_REGION \
    --query 'imageDetails[0].{Architecture:imageManifest}' \
    --output text | head -c 100

# Force update the ECS service
echo "🔄 Forcing ECS service update..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition $TASK_FAMILY \
    --force-new-deployment \
    --region $AWS_REGION

echo "✅ Deployment initiated!"
echo "🔍 Monitor the deployment:"
echo "   aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION"
echo ""
echo "📊 Check ECS console: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$ECS_CLUSTER/services"
echo ""
echo "⏱️  The new deployment should start in a few moments. It may take 2-3 minutes to complete."
