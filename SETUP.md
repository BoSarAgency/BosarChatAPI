# Bosar Chat API - Complete Setup Guide

This guide provides step-by-step instructions to set up the Bosar Chat API from scratch, including AWS infrastructure setup and deployment to ECS.

## Prerequisites

Before starting, ensure you have the following installed and configured:

### Required Tools
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Docker** (for building container images)
- **AWS CLI** (v2 recommended)
- **jq** (for JSON processing in scripts)

### AWS Account Setup
- AWS account with appropriate permissions
- AWS CLI configured with credentials
- Domain registered with Route 53 (or external registrar pointing to Route 53)

### Third-party Services
- **Postmark account** for email functionality
- **OpenAI API key** for AI chat features

## Step 1: Initial Project Setup

### 1.1 Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repository-url>
cd BosarChatAPI

# Install dependencies
npm install
```

### 1.2 Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
NODE_ENV=development
DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/database_name?schema=public"

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret-here
JWT_EXPIRES_IN=24h

# Postmark Email Service
POSTMARK_API_KEY=your-postmark-api-key
FROM_EMAIL=noreply@yourdomain.com

# Frontend URL for password reset links
FRONTEND_URL=https://yourdomain.com

# OpenAI API for AI responses
OPENAI_API_KEY=your-openai-api-key-here

# AWS S3 Configuration (optional - will use local storage if not provided)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-west-1
AWS_S3_BUCKET=your-bucket-name

# WebSocket Configuration
WEBSOCKET_PING_TIMEOUT=60000
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_HEARTBEAT_INTERVAL=30000
```

## Step 2: Domain and Route 53 Setup

### 2.1 Configure Custom Domain

If you have a domain registered with Route 53, it's already configured. If your domain is registered elsewhere, you need to set up Route 53 as your DNS provider:

#### Option A: Domain Registered with Route 53
Your domain is already configured with Route 53. Skip to step 2.2.

#### Option B: Domain Registered Elsewhere
1. **Create a Hosted Zone in Route 53:**
```bash
# Create hosted zone for your domain
aws route53 create-hosted-zone \
    --name yourdomain.com \
    --caller-reference $(date +%s)
```

2. **Get the Name Servers:**
```bash
# Get the name servers for your hosted zone
aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='yourdomain.com.'].Id" \
    --output text | xargs -I {} aws route53 get-hosted-zone --id {} \
    --query "DelegationSet.NameServers" --output table
```

3. **Update Name Servers at Your Registrar:**
   - Log into your domain registrar (GoDaddy, Namecheap, etc.)
   - Update the name servers to use the Route 53 name servers from step 2
   - Wait 24-48 hours for DNS propagation

4. **Verify DNS Propagation:**
```bash
# Check if DNS has propagated
nslookup yourdomain.com
# or
dig yourdomain.com NS
```

### 2.2 Configure AWS CLI

```bash
# Configure AWS CLI with your credentials
aws configure

# Verify configuration
aws sts get-caller-identity
```

## Step 3: AWS Infrastructure Setup

### 3.1 Update Configuration Variables

Before running the setup scripts, update the configuration variables in the following files to match your setup:

**Update `setup-aws-infrastructure.sh`:**
```bash
# Edit these variables at the top of the file
AWS_REGION=your-aws-region          # e.g., us-west-1
ECS_CLUSTER=your-cluster-name       # e.g., bosar-cluster
ECS_SERVICE=your-service-name       # e.g., bosar-service
TASK_FAMILY=your-task-family        # e.g., bosar-task
DOMAIN_NAME=api.yourdomain.com      # Your API domain
ROOT_DOMAIN=yourdomain.com          # Your root domain
```

**Update `deploy-to-ecs.sh`:**
```bash
# Edit these variables at the top of the file
ECR_REPOSITORY=your-account-id.dkr.ecr.your-region.amazonaws.com/your-repo-name
AWS_REGION=your-aws-region
ECS_CLUSTER=your-cluster-name
ECS_SERVICE=your-service-name
TASK_FAMILY=your-task-family
```

### 3.2 Create ECR Repository

```bash
# Create ECR repository for your Docker images
aws ecr create-repository \
    --repository-name bosar-api \
    --region your-aws-region
```

### 3.3 Set Up AWS RDS Database

Create a PostgreSQL RDS instance:

```bash
# Create RDS subnet group
aws rds create-db-subnet-group \
    --db-subnet-group-name bosar-db-subnet-group \
    --db-subnet-group-description "Subnet group for Bosar database" \
    --subnet-ids subnet-xxxxxxxx subnet-yyyyyyyy \
    --region your-aws-region

# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier bosar-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password your-secure-password \
    --allocated-storage 20 \
    --db-subnet-group-name bosar-db-subnet-group \
    --vpc-security-group-ids sg-xxxxxxxx \
    --region your-aws-region
```

### 3.4 Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster \
    --cluster-name bosar-cluster \
    --region your-aws-region
```

## Step 4: Database Setup

### 4.1 Run Database Migrations

**Note**: AWS RDS PostgreSQL already includes the pgvector extension, so no additional installation is needed.

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed the database with initial data
npm run db:seed
```

## Step 5: Update Task Definition

Edit `bosar-task-definition.json` with your specific configuration:

```json
{
  "family": "bosar-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::YOUR-ACCOUNT-ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::YOUR-ACCOUNT-ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "bosar-api",
      "image": "YOUR-ACCOUNT-ID.dkr.ecr.YOUR-REGION.amazonaws.com/bosar-api:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DATABASE_URL",
          "value": "postgresql://postgres:your-password@your-rds-endpoint:5432/your-database?schema=public"
        },
        {
          "name": "JWT_SECRET",
          "value": "your-jwt-secret"
        },
        {
          "name": "POSTMARK_API_KEY",
          "value": "your-postmark-api-key"
        },
        {
          "name": "FROM_EMAIL",
          "value": "noreply@yourdomain.com"
        },
        {
          "name": "FRONTEND_URL",
          "value": "https://yourdomain.com"
        },
        {
          "name": "OPENAI_API_KEY",
          "value": "your-openai-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bosar-task",
          "awslogs-region": "your-aws-region",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Step 6: Deploy to AWS

### 6.1 Complete Infrastructure Setup

Run the complete infrastructure setup script:

```bash
# Make scripts executable
chmod +x setup-complete-infrastructure.sh

# Run complete setup (this will take 10-15 minutes)
./setup-complete-infrastructure.sh
```

This script will:
1. Set up IAM roles
2. Create security groups
3. Set up Application Load Balancer
4. Request and validate SSL certificate
5. Configure Route 53 DNS
6. Deploy the application to ECS

### 6.2 Manual Deployment (Alternative)

If you prefer to run each step manually:

```bash
# Step 1: Set up IAM roles
chmod +x setup-iam-roles.sh
./setup-iam-roles.sh

# Step 2: Set up AWS infrastructure
chmod +x setup-aws-infrastructure.sh
./setup-aws-infrastructure.sh

# Step 3: Validate SSL certificate
chmod +x validate-certificate.sh
./validate-certificate.sh

# Step 4: Set up ALB listeners and Route 53
chmod +x setup-alb-listeners.sh
./setup-alb-listeners.sh

# Step 5: Deploy to ECS
chmod +x deploy-to-ecs.sh
./deploy-to-ecs.sh
```

## Step 7: Verification and Testing

### 7.1 Check Deployment Status

```bash
# Check ECS service status
aws ecs describe-services \
    --cluster bosar-cluster \
    --services bosar-service \
    --region your-aws-region

# Check target group health
aws elbv2 describe-target-health \
    --target-group-arn your-target-group-arn \
    --region your-aws-region
```

### 7.2 Test API Endpoints

```bash
# Test health endpoint
curl https://api.yourdomain.com/api

# Test login endpoint
curl -X POST https://api.yourdomain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"admin123"}'
```

### 7.3 Access Swagger Documentation

In development mode, access the API documentation at:
```
https://api.yourdomain.com/api
```

## Step 8: Post-Deployment Configuration

### 8.1 Create Admin User

```bash
# Run the create admin script
npm run ts-node scripts/create-admin.ts
```

### 8.2 Configure Bot Settings

```bash
# Run the bot settings script
npm run ts-node scripts/create-bot-settings.ts
```

## Troubleshooting

### Common Issues

1. **Certificate validation fails**: Ensure your domain is properly configured in Route 53
2. **ECS service fails to start**: Check CloudWatch logs for detailed error messages
3. **Database connection fails**: Verify RDS security group allows connections from ECS
4. **Docker build fails**: Ensure you're building for the correct platform (linux/amd64)

### Useful Commands

```bash
# View ECS service logs
aws logs tail /ecs/bosar-task --follow --region your-aws-region

# Restart ECS service
aws ecs update-service \
    --cluster bosar-cluster \
    --service bosar-service \
    --force-new-deployment \
    --region your-aws-region

# Check ALB target health
aws elbv2 describe-target-health \
    --target-group-arn your-target-group-arn
```

## Security Considerations

1. **Environment Variables**: Use AWS Parameter Store or Secrets Manager for sensitive data
2. **Database Security**: Ensure RDS is in private subnets with proper security groups
3. **SSL/TLS**: Always use HTTPS in production
4. **IAM Roles**: Follow principle of least privilege for IAM roles
5. **API Keys**: Rotate API keys regularly

## Monitoring and Maintenance

1. **CloudWatch**: Monitor application logs and metrics
2. **Health Checks**: Configure proper health check endpoints
3. **Backups**: Set up automated RDS backups
4. **Updates**: Regularly update dependencies and base images

## Support

For issues and questions:
1. Check CloudWatch logs for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure all AWS resources are properly configured
4. Test individual components before full deployment

---

**Note**: Replace all placeholder values (your-account-id, your-region, yourdomain.com, etc.) with your actual configuration values before running the setup.
