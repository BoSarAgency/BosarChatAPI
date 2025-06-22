# AWS Infrastructure Architecture - BoSar Chat API

## Overview

The BoSar Chat API is deployed on AWS using a modern, scalable, and reliable cloud architecture. This document describes the complete AWS infrastructure setup, including all services, their connections, and how they work together to ensure system reliability and performance.

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Route 53      │    │  Certificate     │    │   CloudWatch    │
│   DNS Service   │    │   Manager        │    │   Monitoring    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                Application Load Balancer (ALB)                  │
│  - SSL Termination                                              │
│  - HTTP → HTTPS Redirect                                        │
│  - WebSocket Support with Sticky Sessions                      │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ECS Fargate Cluster                         │
│  - Container Orchestration                                      │
│  - Auto Scaling                                                 │
│  - Health Checks                                                │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Containers                           │
│  - Node.js API Application                                      │
│  - WebSocket Support                                            │
│  - Health Check Endpoints                                       │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RDS PostgreSQL                              │
│  - Managed Database Service                                     │
│  - pgvector Extension                                           │
│  - Automated Backups                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Core AWS Services

### 1. Amazon ECR (Elastic Container Registry)
**Purpose**: Container image storage and management

**Configuration**:
- Repository: `160885246604.dkr.ecr.us-west-1.amazonaws.com/bosar-api`
- Region: `us-west-1`
- Platform: `linux/amd64` (optimized for ECS Fargate)

**Features**:
- Secure container image storage
- Image vulnerability scanning
- Lifecycle policies for image management
- Integration with ECS for automated deployments

### 2. Amazon ECS (Elastic Container Service) with Fargate
**Purpose**: Container orchestration and management

**Configuration**:
- Cluster: `bosar-cluster`
- Service: `bosar-service`
- Task Family: `bosar-task`
- Launch Type: Fargate (serverless containers)
- CPU: 512 units (0.5 vCPU)
- Memory: 1024 MB (1 GB)
- Platform: Linux/X86_64

**Features**:
- Serverless container execution
- Automatic scaling based on demand
- Health checks and automatic recovery
- Integration with ALB for load balancing
- CloudWatch logging integration

**Task Definition Highlights**:
- Container port: 3001
- Health check endpoint: `/api`
- Environment variables for database, JWT, email, and AI services
- WebSocket configuration for real-time communication

### 3. Amazon RDS (Relational Database Service)
**Purpose**: Managed PostgreSQL database

**Configuration**:
- Engine: PostgreSQL 15.4
- Instance Class: db.t3.micro
- Storage: 20 GB allocated
- Endpoint: `bosar.ctkeiw6kkbeu.us-west-1.rds.amazonaws.com:5432`
- Database: `bosar`

**Features**:
- Built-in pgvector extension for AI/ML vector operations
- Automated backups and point-in-time recovery
- Multi-AZ deployment for high availability
- Encryption at rest and in transit
- Automated software patching

### 4. Application Load Balancer (ALB)
**Purpose**: Load balancing and SSL termination

**Configuration**:
- Name: `bosar-api-alb`
- Scheme: Internet-facing
- Target Group: `bosar-api-tg`
- Health Check Path: `/api`

**Features**:
- SSL/TLS termination with ACM certificates
- HTTP to HTTPS redirect (port 80 → 443)
- WebSocket support with sticky sessions
- Health checks with automatic failover
- Integration with Route 53 for DNS routing

**WebSocket Optimization**:
- Sticky sessions enabled with load balancer cookies
- Cookie duration: 24 hours (86400 seconds)
- Load balancing algorithm: least_outstanding_requests
- Deregistration delay: 30 seconds

### 5. Amazon Route 53
**Purpose**: DNS management and domain routing

**Configuration**:
- Domain: `api.bosar.click`
- Root Domain: `bosar.click`
- Record Type: A record (alias to ALB)

**Features**:
- DNS resolution for custom domain
- Health checks and failover routing
- SSL certificate validation via DNS
- Global DNS distribution

### 6. AWS Certificate Manager (ACM)
**Purpose**: SSL/TLS certificate management

**Configuration**:
- Domain: `api.bosar.click`
- Validation Method: DNS validation
- Auto-renewal enabled

**Features**:
- Free SSL certificates
- Automatic certificate renewal
- Integration with ALB for HTTPS
- DNS-based domain validation

### 7. Amazon CloudWatch
**Purpose**: Monitoring, logging, and alerting

**Configuration**:
- Log Group: `/ecs/bosar-task`
- Region: `us-west-1`
- Log Stream Prefix: `ecs`

**Features**:
- Application and container logs
- Performance metrics and monitoring
- Custom dashboards and alerts
- Integration with ECS for container insights

## Security Architecture

### Network Security
**VPC Configuration**:
- Uses default VPC with multiple availability zones
- Public subnets for ALB (internet-facing)
- Private subnets for ECS tasks (recommended for production)

**Security Groups**:

1. **ALB Security Group** (`bosar-alb-sg`):
   - Inbound: HTTP (80) and HTTPS (443) from anywhere (0.0.0.0/0)
   - Outbound: All traffic to ECS security group

2. **ECS Security Group** (`bosar-ecs-sg`):
   - Inbound: Port 3001 from ALB security group only
   - Outbound: All traffic (for database and external API calls)

### IAM Roles and Permissions

1. **ECS Task Execution Role** (`ecsTaskExecutionRole`):
   - Permissions: Pull images from ECR, write logs to CloudWatch
   - Policy: `AmazonECSTaskExecutionRolePolicy`

2. **ECS Task Role** (`ecsTaskRole`):
   - Permissions: Application-specific AWS service access
   - Custom policies for CloudWatch logs

### Data Security
- **Database**: RDS with encryption at rest and in transit
- **Secrets**: Environment variables in task definition (recommend AWS Secrets Manager for production)
- **SSL/TLS**: End-to-end encryption via ACM certificates
- **Container Security**: Regular image scanning via ECR

## High Availability and Reliability

### Multi-AZ Deployment
- **ALB**: Deployed across multiple availability zones
- **ECS**: Tasks distributed across multiple AZs
- **RDS**: Multi-AZ deployment for database failover

### Auto Scaling
- **ECS Service**: Automatic scaling based on CPU/memory utilization
- **ALB**: Automatic load distribution across healthy targets
- **RDS**: Storage auto-scaling enabled

### Health Checks and Monitoring
- **ALB Health Checks**: 
  - Path: `/api`
  - Interval: 30 seconds
  - Timeout: 5 seconds
  - Healthy threshold: 2
  - Unhealthy threshold: 3

- **ECS Health Checks**:
  - Container-level health checks via curl
  - Automatic task replacement on failure
  - Integration with ALB target group

### Backup and Recovery
- **RDS**: Automated daily backups with 7-day retention
- **Point-in-time Recovery**: Up to 35 days
- **Container Images**: Versioned storage in ECR
- **Infrastructure as Code**: All infrastructure scripted for reproducibility

## Performance Optimization

### WebSocket Support
- Sticky sessions for persistent connections
- Optimized load balancing algorithm
- Reduced deregistration delay for faster failover

### Database Performance
- pgvector extension for efficient vector operations
- Connection pooling in application layer
- Optimized queries with proper indexing

### Caching and CDN
- Application-level caching for frequently accessed data
- CloudFront integration (can be added for static assets)

## Deployment Pipeline

### Automated Deployment Process
1. **Build**: Docker image built for linux/amd64 platform
2. **Push**: Image pushed to ECR repository
3. **Database**: Prisma migrations executed
4. **Deploy**: ECS service updated with new task definition
5. **Health Check**: ALB verifies application health
6. **Traffic**: Gradual traffic shift to new containers

### Deployment Scripts
- `setup-complete-infrastructure.sh`: Complete infrastructure setup
- `deploy-to-ecs.sh`: Application deployment
- `validate-certificate.sh`: SSL certificate validation
- `setup-alb-listeners.sh`: Load balancer configuration

## Cost Optimization

### Resource Sizing
- **ECS Fargate**: Right-sized containers (0.5 vCPU, 1GB RAM)
- **RDS**: db.t3.micro for development/small production workloads
- **ALB**: Pay-per-use pricing model

### Cost Monitoring
- CloudWatch for resource utilization tracking
- AWS Cost Explorer for spend analysis
- Reserved instances for predictable workloads

## Maintenance and Operations

### Regular Maintenance Tasks
1. **Security Updates**: Regular base image and dependency updates
2. **Certificate Renewal**: Automatic via ACM
3. **Database Maintenance**: Automated via RDS
4. **Log Rotation**: Automatic via CloudWatch
5. **Backup Verification**: Regular restore testing

### Monitoring and Alerting
- Application performance monitoring via CloudWatch
- Database performance insights via RDS Performance Insights
- Custom alerts for critical metrics
- Log aggregation and analysis

## Disaster Recovery

### Recovery Time Objective (RTO)
- **Application**: < 5 minutes (automatic ECS task replacement)
- **Database**: < 15 minutes (RDS Multi-AZ failover)
- **DNS**: < 5 minutes (Route 53 health checks)

### Recovery Point Objective (RPO)
- **Database**: < 5 minutes (continuous backup)
- **Application State**: Stateless design minimizes data loss
- **Configuration**: Infrastructure as Code ensures reproducibility

This architecture provides a robust, scalable, and secure foundation for the BoSar Chat API, ensuring high availability, performance, and reliability for production workloads.
