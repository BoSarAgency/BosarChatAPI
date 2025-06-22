#!/bin/bash
set -e

echo "🚀 BoSar API - Complete AWS Infrastructure Setup"
echo "=============================================="
echo ""

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "❌ jq is required but not installed. Please install jq first." >&2; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Make all scripts executable
chmod +x setup-iam-roles.sh
chmod +x setup-aws-infrastructure.sh
chmod +x validate-certificate.sh
chmod +x setup-alb-listeners.sh
chmod +x deploy-to-ecs.sh

echo "📋 Step 1: Setting up IAM Roles..."
./setup-iam-roles.sh
echo ""

echo "📋 Step 2: Setting up AWS Infrastructure (ALB, Security Groups, etc.)..."
./setup-aws-infrastructure.sh
echo ""

echo "📋 Step 3: Validating SSL Certificate..."
echo "⚠️  This step will create DNS validation records and wait for certificate validation."
echo "⚠️  This may take 5-10 minutes. Please be patient..."
./validate-certificate.sh
echo ""

echo "📋 Step 4: Setting up ALB Listeners and Route 53..."
./setup-alb-listeners.sh
echo ""

echo "📋 Step 5: Deploying application to ECS..."
./deploy-to-ecs.sh
echo ""

echo "🎉 Complete infrastructure setup finished!"
echo ""
echo "📋 Summary:"
echo "   ✅ IAM Roles created"
echo "   ✅ Security Groups configured"
echo "   ✅ Application Load Balancer deployed"
echo "   ✅ SSL Certificate validated"
echo "   ✅ Route 53 DNS configured"
echo "   ✅ ECS Service deployed"
echo ""
echo "🌐 Your API should be available at: https://api.bosar.click"
echo "📖 Swagger documentation: https://api.bosar.click/api"
echo ""
echo "⏳ Please allow 5-10 minutes for DNS propagation and service startup."
echo ""
echo "🔍 Monitoring URLs:"
echo "   - ECS Console: https://console.aws.amazon.com/ecs/home?region=us-west-1"
echo "   - Load Balancer: https://console.aws.amazon.com/ec2/v2/home?region=us-west-1#LoadBalancers:"
echo "   - Route 53: https://console.aws.amazon.com/route53/v2/hostedzones"
