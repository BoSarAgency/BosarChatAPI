#!/bin/bash
set -e

# Route 53 Domain Connection Script
# This script connects a custom domain from Route 53 to your existing AWS infrastructure

# Default configuration (can be overridden by command line arguments)
AWS_REGION=${AWS_REGION:-us-west-1}
ALB_NAME=${ALB_NAME:-bosar-api-alb}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Connect a Route 53 domain to your AWS infrastructure"
    echo ""
    echo "Options:"
    echo "  -d, --domain DOMAIN        Domain name to connect (e.g., api.example.com)"
    echo "  -r, --root-domain ROOT     Root domain for hosted zone (e.g., example.com)"
    echo "  -a, --alb-name ALB_NAME    ALB name (default: bosar-api-alb)"
    echo "  --region REGION            AWS region (default: us-west-1)"
    echo "  --ssl                      Request and validate SSL certificate"
    echo "  --dry-run                  Show what would be done without making changes"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -d api.mycompany.com -r mycompany.com --ssl"
    echo "  $0 -d staging.myapp.io -r myapp.io --region us-east-1"
    echo "  $0 --domain custom.example.org --root-domain example.org --dry-run"
}

# Parse command line arguments
DOMAIN_NAME=""
ROOT_DOMAIN=""
REQUEST_SSL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        -r|--root-domain)
            ROOT_DOMAIN="$2"
            shift 2
            ;;
        -a|--alb-name)
            ALB_NAME="$2"
            shift 2
            ;;
        --region)
            AWS_REGION="$2"
            shift 2
            ;;
        --ssl)
            REQUEST_SSL=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$DOMAIN_NAME" ]; then
    print_error "Domain name is required. Use -d or --domain option."
    show_usage
    exit 1
fi

if [ -z "$ROOT_DOMAIN" ]; then
    print_error "Root domain is required. Use -r or --root-domain option."
    show_usage
    exit 1
fi

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is required but not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { print_error "jq is required but not installed. Please install jq."; exit 1; }

echo "🚀 Route 53 Domain Connection Script"
echo "===================================="
echo ""
echo "Configuration:"
echo "  Domain: $DOMAIN_NAME"
echo "  Root Domain: $ROOT_DOMAIN"
echo "  ALB Name: $ALB_NAME"
echo "  AWS Region: $AWS_REGION"
echo "  Request SSL: $REQUEST_SSL"
echo "  Dry Run: $DRY_RUN"
echo ""

# Function to execute or simulate command
execute_command() {
    local description="$1"
    local command="$2"
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "[DRY RUN] Would execute: $description"
        echo "Command: $command"
        echo ""
        return 0
    else
        print_status "$description"
        eval "$command"
    fi
}

# Step 1: Verify ALB exists
print_status "Verifying Application Load Balancer exists..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names $ALB_NAME \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null || echo "None")

if [ "$ALB_ARN" == "None" ] || [ -z "$ALB_ARN" ]; then
    print_error "Application Load Balancer '$ALB_NAME' not found in region $AWS_REGION"
    print_warning "Please ensure your infrastructure is set up first by running:"
    print_warning "  ./setup-aws-infrastructure.sh"
    exit 1
fi

# Get ALB DNS name and hosted zone ID
ALB_DNS_NAME=$(aws elbv2 describe-load-balancers \
    --names $ALB_NAME \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

ALB_HOSTED_ZONE_ID=$(aws elbv2 describe-load-balancers \
    --names $ALB_NAME \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].CanonicalHostedZoneId' \
    --output text)

print_success "ALB found: $ALB_DNS_NAME"

# Step 2: Verify Route 53 hosted zone exists
print_status "Verifying Route 53 hosted zone for $ROOT_DOMAIN..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='$ROOT_DOMAIN.'].Id" \
    --output text | sed 's|/hostedzone/||')

if [ -z "$HOSTED_ZONE_ID" ] || [ "$HOSTED_ZONE_ID" == "None" ]; then
    print_error "Route 53 hosted zone for '$ROOT_DOMAIN' not found"
    print_warning "Please ensure you have a hosted zone for your root domain in Route 53"
    exit 1
fi

print_success "Hosted zone found: $HOSTED_ZONE_ID"

# Step 3: Request SSL certificate if requested
CERT_ARN=""
if [ "$REQUEST_SSL" = true ]; then
    print_status "Requesting SSL certificate for $DOMAIN_NAME..."
    
    if [ "$DRY_RUN" = false ]; then
        # Check if certificate already exists
        EXISTING_CERT=$(aws acm list-certificates \
            --region $AWS_REGION \
            --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
            --output text)
        
        if [ -n "$EXISTING_CERT" ] && [ "$EXISTING_CERT" != "None" ]; then
            CERT_ARN="$EXISTING_CERT"
            print_success "Using existing certificate: $CERT_ARN"
        else
            CERT_ARN=$(aws acm request-certificate \
                --domain-name $DOMAIN_NAME \
                --validation-method DNS \
                --region $AWS_REGION \
                --query 'CertificateArn' \
                --output text)
            print_success "Certificate requested: $CERT_ARN"
        fi
    else
        print_warning "[DRY RUN] Would request SSL certificate for $DOMAIN_NAME"
    fi
fi

# Step 4: Create Route 53 A record
print_status "Creating Route 53 A record for $DOMAIN_NAME..."

ROUTE53_RECORD_JSON=$(cat << EOF
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
)

if [ "$DRY_RUN" = false ]; then
    echo "$ROUTE53_RECORD_JSON" > route53-record-temp.json
    aws route53 change-resource-record-sets \
        --hosted-zone-id $HOSTED_ZONE_ID \
        --change-batch file://route53-record-temp.json
    rm -f route53-record-temp.json
    print_success "Route 53 A record created successfully!"
else
    print_warning "[DRY RUN] Would create Route 53 record:"
    echo "$ROUTE53_RECORD_JSON"
fi

# Step 5: Handle SSL certificate validation if requested
if [ "$REQUEST_SSL" = true ] && [ -n "$CERT_ARN" ] && [ "$DRY_RUN" = false ]; then
    print_status "Setting up SSL certificate validation..."
    
    # Get validation records
    VALIDATION_RECORDS=$(aws acm describe-certificate \
        --certificate-arn $CERT_ARN \
        --region $AWS_REGION \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord')
    
    VALIDATION_NAME=$(echo $VALIDATION_RECORDS | jq -r '.Name')
    VALIDATION_VALUE=$(echo $VALIDATION_RECORDS | jq -r '.Value')
    VALIDATION_TYPE=$(echo $VALIDATION_RECORDS | jq -r '.Type')
    
    print_status "Creating DNS validation record..."
    
    VALIDATION_RECORD_JSON=$(cat << EOF
{
    "Comment": "DNS validation for $DOMAIN_NAME SSL certificate",
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$VALIDATION_NAME",
                "Type": "$VALIDATION_TYPE",
                "TTL": 300,
                "ResourceRecords": [
                    {
                        "Value": "$VALIDATION_VALUE"
                    }
                ]
            }
        }
    ]
}
EOF
)
    
    echo "$VALIDATION_RECORD_JSON" > dns-validation-temp.json
    aws route53 change-resource-record-sets \
        --hosted-zone-id $HOSTED_ZONE_ID \
        --change-batch file://dns-validation-temp.json
    rm -f dns-validation-temp.json
    
    print_success "DNS validation record created!"
    print_warning "Certificate validation may take 5-10 minutes..."
fi

# Summary
echo ""
echo "🎉 Domain connection process completed!"
echo "======================================"
echo ""
echo "📋 Summary:"
echo "   Domain: $DOMAIN_NAME"
echo "   ALB: $ALB_DNS_NAME"
echo "   Route 53 Hosted Zone: $HOSTED_ZONE_ID"
if [ -n "$CERT_ARN" ]; then
    echo "   SSL Certificate: $CERT_ARN"
fi
echo ""

if [ "$DRY_RUN" = false ]; then
    print_success "Your domain should be accessible at: https://$DOMAIN_NAME"
    print_warning "DNS propagation may take a few minutes to complete."
    
    if [ "$REQUEST_SSL" = true ]; then
        print_warning "SSL certificate validation is in progress."
        print_warning "You can check the status with:"
        echo "  aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION"
    fi
else
    print_warning "This was a dry run. No changes were made."
    print_warning "Run without --dry-run to execute the changes."
fi

echo ""
print_warning "Next steps:"
echo "1. Wait for DNS propagation (2-5 minutes)"
if [ "$REQUEST_SSL" = true ]; then
    echo "2. Wait for SSL certificate validation (5-10 minutes)"
    echo "3. Update your ALB listeners to use the new certificate if needed"
fi
echo "4. Test your domain: curl -I https://$DOMAIN_NAME"
