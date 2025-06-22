#!/bin/bash
set -e

# ALB SSL Certificate Update Script
# This script updates ALB listeners to use a specific SSL certificate

# Default configuration
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
    echo "Update ALB HTTPS listener to use a specific SSL certificate"
    echo ""
    echo "Options:"
    echo "  -d, --domain DOMAIN        Domain name for certificate lookup"
    echo "  -c, --cert-arn CERT_ARN    Certificate ARN to use"
    echo "  -a, --alb-name ALB_NAME    ALB name (default: bosar-api-alb)"
    echo "  --region REGION            AWS region (default: us-west-1)"
    echo "  --list-certs               List available certificates"
    echo "  --dry-run                  Show what would be done without making changes"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -d api.mycompany.com"
    echo "  $0 -c arn:aws:acm:us-west-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
    echo "  $0 --list-certs"
}

# Parse command line arguments
DOMAIN_NAME=""
CERT_ARN=""
LIST_CERTS=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        -c|--cert-arn)
            CERT_ARN="$2"
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
        --list-certs)
            LIST_CERTS=true
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

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is required but not installed. Aborting."; exit 1; }

echo "🔒 ALB SSL Certificate Update Script"
echo "===================================="
echo ""

# List certificates if requested
if [ "$LIST_CERTS" = true ]; then
    print_status "Listing available SSL certificates in $AWS_REGION..."
    echo ""
    aws acm list-certificates \
        --region $AWS_REGION \
        --query 'CertificateSummaryList[*].[DomainName,CertificateArn,Status]' \
        --output table
    echo ""
    exit 0
fi

# Validate parameters
if [ -z "$DOMAIN_NAME" ] && [ -z "$CERT_ARN" ]; then
    print_error "Either domain name (-d) or certificate ARN (-c) is required."
    show_usage
    exit 1
fi

echo "Configuration:"
echo "  ALB Name: $ALB_NAME"
echo "  AWS Region: $AWS_REGION"
if [ -n "$DOMAIN_NAME" ]; then
    echo "  Domain: $DOMAIN_NAME"
fi
if [ -n "$CERT_ARN" ]; then
    echo "  Certificate ARN: $CERT_ARN"
fi
echo "  Dry Run: $DRY_RUN"
echo ""

# Step 1: Get ALB ARN
print_status "Finding Application Load Balancer..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names $ALB_NAME \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null || echo "None")

if [ "$ALB_ARN" == "None" ] || [ -z "$ALB_ARN" ]; then
    print_error "Application Load Balancer '$ALB_NAME' not found in region $AWS_REGION"
    exit 1
fi

print_success "ALB found: $ALB_NAME"

# Step 2: Find certificate ARN if domain was provided
if [ -n "$DOMAIN_NAME" ] && [ -z "$CERT_ARN" ]; then
    print_status "Finding SSL certificate for $DOMAIN_NAME..."
    CERT_ARN=$(aws acm list-certificates \
        --region $AWS_REGION \
        --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
        --output text)
    
    if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
        print_error "SSL certificate for '$DOMAIN_NAME' not found in region $AWS_REGION"
        print_warning "Available certificates:"
        aws acm list-certificates \
            --region $AWS_REGION \
            --query 'CertificateSummaryList[*].[DomainName,Status]' \
            --output table
        exit 1
    fi
fi

print_success "Certificate found: $CERT_ARN"

# Step 3: Check certificate status
print_status "Checking certificate status..."
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn $CERT_ARN \
    --region $AWS_REGION \
    --query 'Certificate.Status' \
    --output text)

if [ "$CERT_STATUS" != "ISSUED" ]; then
    print_warning "Certificate status is: $CERT_STATUS"
    if [ "$CERT_STATUS" == "PENDING_VALIDATION" ]; then
        print_warning "Certificate is still pending validation. Please complete DNS validation first."
        exit 1
    fi
fi

print_success "Certificate status: $CERT_STATUS"

# Step 4: Find HTTPS listener
print_status "Finding HTTPS listener on ALB..."
HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn $ALB_ARN \
    --region $AWS_REGION \
    --query 'Listeners[?Port==`443`].ListenerArn' \
    --output text)

if [ -z "$HTTPS_LISTENER_ARN" ] || [ "$HTTPS_LISTENER_ARN" == "None" ]; then
    print_error "HTTPS listener (port 443) not found on ALB"
    print_warning "Available listeners:"
    aws elbv2 describe-listeners \
        --load-balancer-arn $ALB_ARN \
        --region $AWS_REGION \
        --query 'Listeners[*].[Port,Protocol,ListenerArn]' \
        --output table
    exit 1
fi

print_success "HTTPS listener found: $HTTPS_LISTENER_ARN"

# Step 5: Get current certificate on listener
print_status "Checking current certificate on listener..."
CURRENT_CERT=$(aws elbv2 describe-listeners \
    --listener-arns $HTTPS_LISTENER_ARN \
    --region $AWS_REGION \
    --query 'Listeners[0].Certificates[0].CertificateArn' \
    --output text 2>/dev/null || echo "None")

if [ "$CURRENT_CERT" == "$CERT_ARN" ]; then
    print_success "Certificate is already configured on the listener!"
    echo ""
    echo "Current configuration:"
    echo "  Listener: $HTTPS_LISTENER_ARN"
    echo "  Certificate: $CERT_ARN"
    exit 0
fi

print_status "Current certificate: $CURRENT_CERT"
print_status "New certificate: $CERT_ARN"

# Step 6: Update listener certificate
if [ "$DRY_RUN" = true ]; then
    print_warning "[DRY RUN] Would update HTTPS listener certificate"
    echo "Command: aws elbv2 modify-listener --listener-arn $HTTPS_LISTENER_ARN --certificates CertificateArn=$CERT_ARN --region $AWS_REGION"
else
    print_status "Updating HTTPS listener certificate..."
    aws elbv2 modify-listener \
        --listener-arn $HTTPS_LISTENER_ARN \
        --certificates CertificateArn=$CERT_ARN \
        --region $AWS_REGION
    
    print_success "HTTPS listener certificate updated successfully!"
fi

# Summary
echo ""
echo "🎉 SSL Certificate Update Completed!"
echo "===================================="
echo ""
echo "📋 Summary:"
echo "   ALB: $ALB_NAME"
echo "   Listener: $HTTPS_LISTENER_ARN"
echo "   Certificate: $CERT_ARN"
if [ -n "$DOMAIN_NAME" ]; then
    echo "   Domain: $DOMAIN_NAME"
fi
echo ""

if [ "$DRY_RUN" = false ]; then
    print_success "Your HTTPS listener is now using the updated certificate!"
    print_warning "Changes take effect immediately, but DNS propagation may take a few minutes."
else
    print_warning "This was a dry run. No changes were made."
fi

echo ""
print_warning "You can verify the certificate with:"
echo "  curl -I https://your-domain.com"
echo "  openssl s_client -connect your-domain.com:443 -servername your-domain.com"
