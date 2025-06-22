#!/bin/bash
set -e

# Configuration
AWS_REGION=us-west-1
DOMAIN_NAME=api.bosar.click
ROOT_DOMAIN=bosar.click

echo "🔐 Validating SSL Certificate for $DOMAIN_NAME..."

# Get Certificate ARN
CERT_ARN=$(aws acm list-certificates \
    --region $AWS_REGION \
    --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
    --output text)

if [ -z "$CERT_ARN" ]; then
    echo "❌ Certificate not found for $DOMAIN_NAME"
    exit 1
fi

echo "🔐 Certificate ARN: $CERT_ARN"

# Get validation records
echo "📋 Getting DNS validation records..."
VALIDATION_RECORDS=$(aws acm describe-certificate \
    --certificate-arn $CERT_ARN \
    --region $AWS_REGION \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord')

VALIDATION_NAME=$(echo $VALIDATION_RECORDS | jq -r '.Name')
VALIDATION_VALUE=$(echo $VALIDATION_RECORDS | jq -r '.Value')
VALIDATION_TYPE=$(echo $VALIDATION_RECORDS | jq -r '.Type')

echo "📋 Validation Name: $VALIDATION_NAME"
echo "📋 Validation Value: $VALIDATION_VALUE"
echo "📋 Validation Type: $VALIDATION_TYPE"

# Get Route 53 Hosted Zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='$ROOT_DOMAIN.'].Id" \
    --output text | sed 's|/hostedzone/||')

echo "🌐 Hosted Zone ID: $HOSTED_ZONE_ID"

# Create DNS validation record
echo "📝 Creating DNS validation record in Route 53..."
cat > dns-validation-record.json << EOF
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

aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch file://dns-validation-record.json

echo "✅ DNS validation record created successfully!"
echo "⏳ Waiting for certificate validation (this may take a few minutes)..."

# Wait for certificate validation
aws acm wait certificate-validated \
    --certificate-arn $CERT_ARN \
    --region $AWS_REGION

echo "✅ Certificate validated successfully!"

# Clean up temporary file
rm -f dns-validation-record.json

echo "🎉 SSL Certificate is now ready for use!"
