#!/bin/bash
set -e

# Configuration
AWS_REGION=us-west-1

echo "🔐 Setting up IAM Roles for ECS..."

# Create ECS Task Execution Role
echo "📋 Creating ECS Task Execution Role..."
cat > ecs-task-execution-role-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document file://ecs-task-execution-role-trust-policy.json 2>/dev/null || echo "ecsTaskExecutionRole already exists"

aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || echo "Policy already attached"

# Create ECS Task Role
echo "📋 Creating ECS Task Role..."
cat > ecs-task-role-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

aws iam create-role \
    --role-name ecsTaskRole \
    --assume-role-policy-document file://ecs-task-role-trust-policy.json 2>/dev/null || echo "ecsTaskRole already exists"

# Create custom policy for ECS Task Role (if needed for specific permissions)
cat > ecs-task-role-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
EOF

aws iam put-role-policy \
    --role-name ecsTaskRole \
    --policy-name ECSTaskRolePolicy \
    --policy-document file://ecs-task-role-policy.json 2>/dev/null || echo "Policy already exists"

# Get role ARNs
EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text)
TASK_ROLE_ARN=$(aws iam get-role --role-name ecsTaskRole --query 'Role.Arn' --output text)

echo "✅ IAM Roles created successfully!"
echo "📋 Execution Role ARN: $EXECUTION_ROLE_ARN"
echo "📋 Task Role ARN: $TASK_ROLE_ARN"

# Clean up temporary files
rm -f ecs-task-execution-role-trust-policy.json
rm -f ecs-task-role-trust-policy.json
rm -f ecs-task-role-policy.json

echo "🎉 IAM setup completed!"
