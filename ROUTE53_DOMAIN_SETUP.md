# Route 53 Domain Connection Guide

This guide explains how to connect custom domains from Route 53 to your AWS infrastructure using the provided scripts.

## Overview

You have several options for connecting domains:

1. **Automated Setup**: Use existing infrastructure scripts (recommended for initial setup)
2. **Custom Domain Connection**: Use the standalone domain connection script
3. **SSL Certificate Management**: Update ALB listeners with new certificates

## Prerequisites

- AWS CLI configured with appropriate permissions
- `jq` installed for JSON processing
- Route 53 hosted zone for your domain
- Existing AWS infrastructure (ALB, ECS, etc.)

### Install jq (if not already installed)

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Amazon Linux/CentOS/RHEL
sudo yum install jq
```

## Method 1: Complete Infrastructure Setup (Recommended for New Deployments)

If you're setting up everything from scratch, use the existing comprehensive scripts:

```bash
# Complete setup including domain connection
./setup-complete-infrastructure.sh
```

This handles:
- Infrastructure setup
- SSL certificate request and validation
- Route 53 DNS configuration
- Application deployment

## Method 2: Connect Additional Custom Domains

Use the standalone domain connection script to add additional domains to your existing infrastructure.

### Basic Usage

```bash
# Connect a custom domain with SSL
./connect-route53-domain.sh -d api.mycompany.com -r mycompany.com --ssl

# Connect without requesting new SSL certificate
./connect-route53-domain.sh -d staging.myapp.io -r myapp.io

# Dry run to see what would happen
./connect-route53-domain.sh -d test.example.com -r example.com --ssl --dry-run
```

### Script Options

| Option | Description | Example |
|--------|-------------|---------|
| `-d, --domain` | Domain name to connect | `api.example.com` |
| `-r, --root-domain` | Root domain for hosted zone | `example.com` |
| `-a, --alb-name` | ALB name (default: bosar-api-alb) | `my-custom-alb` |
| `--region` | AWS region (default: us-west-1) | `us-east-1` |
| `--ssl` | Request and validate SSL certificate | |
| `--dry-run` | Preview changes without executing | |
| `-h, --help` | Show help message | |

### Examples

#### Connect Production Domain
```bash
./connect-route53-domain.sh \
  --domain api.mycompany.com \
  --root-domain mycompany.com \
  --ssl \
  --region us-west-1
```

#### Connect Staging Domain
```bash
./connect-route53-domain.sh \
  --domain staging-api.mycompany.com \
  --root-domain mycompany.com \
  --ssl
```

#### Connect to Different ALB
```bash
./connect-route53-domain.sh \
  --domain api.development.com \
  --root-domain development.com \
  --alb-name dev-api-alb \
  --region us-east-1
```

## Method 3: SSL Certificate Management

Use the SSL certificate management script to update ALB listeners with new or different certificates.

### Basic Usage

```bash
# Update listener to use certificate for specific domain
./update-alb-ssl-certificate.sh -d api.mycompany.com

# Update listener with specific certificate ARN
./update-alb-ssl-certificate.sh -c arn:aws:acm:us-west-1:123456789012:certificate/12345678-1234-1234-1234-123456789012

# List available certificates
./update-alb-ssl-certificate.sh --list-certs

# Dry run
./update-alb-ssl-certificate.sh -d api.example.com --dry-run
```

### Script Options

| Option | Description | Example |
|--------|-------------|---------|
| `-d, --domain` | Domain name for certificate lookup | `api.example.com` |
| `-c, --cert-arn` | Specific certificate ARN to use | `arn:aws:acm:...` |
| `-a, --alb-name` | ALB name (default: bosar-api-alb) | `my-custom-alb` |
| `--region` | AWS region (default: us-west-1) | `us-east-1` |
| `--list-certs` | List available certificates | |
| `--dry-run` | Preview changes without executing | |
| `-h, --help` | Show help message | |

## Complete Workflow Examples

### Scenario 1: Add New Production Domain

```bash
# 1. Connect the domain and request SSL certificate
./connect-route53-domain.sh -d api.newcompany.com -r newcompany.com --ssl

# 2. Wait for certificate validation (5-10 minutes)
# The script will create the necessary DNS validation records

# 3. Verify the domain is working
curl -I https://api.newcompany.com
```

### Scenario 2: Multiple Environment Domains

```bash
# Production
./connect-route53-domain.sh -d api.myapp.com -r myapp.com --ssl

# Staging
./connect-route53-domain.sh -d staging-api.myapp.com -r myapp.com --ssl

# Development
./connect-route53-domain.sh -d dev-api.myapp.com -r myapp.com --ssl
```

### Scenario 3: Update Existing Domain Certificate

```bash
# List current certificates
./update-alb-ssl-certificate.sh --list-certs

# Update to use specific certificate
./update-alb-ssl-certificate.sh -d api.mycompany.com

# Or use specific certificate ARN
./update-alb-ssl-certificate.sh -c arn:aws:acm:us-west-1:123456789012:certificate/new-cert-id
```

## Troubleshooting

### Common Issues

1. **"Hosted zone not found"**
   - Ensure your domain is registered and has a Route 53 hosted zone
   - Check that the root domain matches exactly (e.g., `example.com` not `www.example.com`)

2. **"ALB not found"**
   - Run the infrastructure setup first: `./setup-aws-infrastructure.sh`
   - Check the ALB name and region are correct

3. **"Certificate validation pending"**
   - DNS validation records are created automatically
   - Wait 5-10 minutes for validation to complete
   - Check Route 53 records were created correctly

4. **"Permission denied"**
   - Ensure AWS CLI has necessary permissions for Route 53, ACM, and ELB
   - Check IAM policies include required actions

### Verification Commands

```bash
# Check DNS resolution
nslookup api.mycompany.com

# Test HTTPS connection
curl -I https://api.mycompany.com

# Check certificate details
openssl s_client -connect api.mycompany.com:443 -servername api.mycompany.com

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn YOUR_TARGET_GROUP_ARN

# Check certificate status
aws acm describe-certificate --certificate-arn YOUR_CERT_ARN --region us-west-1
```

## Security Considerations

- SSL certificates are automatically validated using DNS validation
- All connections are redirected from HTTP to HTTPS
- Certificates are managed through AWS Certificate Manager
- Route 53 records use alias targets for better performance and cost

## Cost Implications

- Route 53 hosted zones: $0.50/month per hosted zone
- Route 53 queries: $0.40 per million queries
- SSL certificates through ACM: Free for AWS resources
- ALB: Standard ALB pricing applies

## Next Steps

After connecting your domain:

1. Update your application configuration to use the new domain
2. Update any API documentation or client configurations
3. Set up monitoring and alerts for the new domain
4. Consider setting up additional DNS records (CNAME, MX, etc.) as needed

## Support

If you encounter issues:

1. Check the AWS CloudFormation console for any failed resources
2. Review CloudWatch logs for your ECS service
3. Verify Route 53 DNS propagation using online DNS checkers
4. Check ALB access logs for connection issues
