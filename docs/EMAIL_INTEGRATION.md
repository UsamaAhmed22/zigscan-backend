# Email Integration with SendGrid

## Overview
Implemented email functionality for user authentication flows including email verification and password reset with strict security measures.

## Features Implemented

### 1. Email Service (`src/users/email.service.ts`)
- **Provider**: SendGrid SMTP (smtp.sendgrid.net:465)
- **Transport**: Nodemailer with SSL/TLS
- **Email Types**:
  - Verification Email (sent on signup)
  - Password Reset Email with 6-digit code (sent on forgot password)

### 2. Email Templates
Both email types include:
- Responsive HTML design with gradient styling
- Clear call-to-action instructions
- Branding with ZigScan
- Professional formatting
- Security warnings and notices

### 3. Password Reset Security

#### 6-Digit Verification Code
- Reset codes are **6 digits** (e.g., 123456)
- Easy to read and enter in frontend
- User-friendly format for quick entry
- Code displayed prominently in email

#### 3-Minute Token Expiry
- Reset codes expire **3 minutes** after generation
- Short expiry window minimizes security risk
- Clear warning displayed in email template
- Code validation checks expiry before allowing password reset

#### 24-Hour Rate Limiting
- Users can only request password reset **once every 24 hours**
- Rate limit tracked via `last_password_reset_request` timestamp in User entity
- Prevents abuse and brute force attempts
- Clear error message shows remaining hours if rate limit exceeded

### 4. Database Changes

#### New Column Added to `users` Table:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_reset_request TIMESTAMP;
```

**Purpose**: Track when user last requested password reset for rate limiting

## Configuration

### Environment Variables (.env)
```bash
# SMTP Configuration (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=apikey
SMTP_PASS=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
SMTP_FROM="DegenTer Bot <info@degenter.io>"

# Frontend URL for email links
FRONTEND_URL=http://localhost:3000
```

**Note**: Update `FRONTEND_URL` for production environment.

## API Endpoints

### 1. Sign Up (with Email Verification)
**POST** `/api/v1/auth/signup`
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePass123!"
}
```

**Response**: Sends verification email with token

### 2. Verify Email
**POST** `/api/v1/auth/verify-email`
```json
{
  "token": "verification-token-from-email"
}
```

### 3. Forgot Password (with Rate Limiting)
**POST** `/api/v1/auth/forgot-password`
```json
{
  "email": "user@example.com"
}
```

**Response**: 
- Success: Sends password reset email with 6-digit code
- Rate Limited: Error message with hours remaining

**Rate Limit Error Example**:
```json
{
  "statusCode": 400,
  "message": "You can only request a password reset once every 24 hours. Please try again in 18 hour(s)."
}
```

**Success Response**:
```json
{
  "message": "If the email exists, a 6-digit verification code has been sent to your email."
}
```

### 4. Reset Password
**POST** `/api/v1/auth/reset-password`
```json
{
  "token": "123456",
  "newPassword": "NewSecurePass123!"
}
```

**Token**: Now a 6-digit code (e.g., "123456") instead of long hash

**Token Expiry Check**: Returns error if code expired (>3 minutes old)

## Security Features

### Token Generation
- Uses `crypto.randomBytes(32)` for secure email verification tokens
- Uses `Math.random()` for 6-digit codes (100000-999999)
- 6-digit codes are easy to read and type
- Unpredictable within the numeric range

### 2. Password Hashing
- bcrypt with 12 salt rounds
- Secure password storage
- Slow hash prevents brute force attacks

### 3. Email Existence Protection
- Generic success messages don't reveal if email exists
- Prevents user enumeration attacks
- Same response for existing and non-existing emails

### 4. Rate Limiting
- 24-hour cooldown between password reset requests
- Prevents spam and abuse
- Tracked at database level

### 5. Token Expiry
- 3-minute expiry for password reset codes
- Minimizes window of opportunity for attacks
- Forces quick action from legitimate users
- 6-digit format makes it easy to enter quickly

## Implementation Details

### UsersService Updates
```typescript
// Constants
private readonly TOKEN_EXPIRY_MINUTES = 3; // Code valid for 3 minutes
private readonly RATE_LIMIT_HOURS = 24; // Can only request reset once per 24 hours

// Generate 6-digit code
private generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Dependencies
constructor(
  // ... other dependencies
  private readonly emailService: EmailService,
) {}
```

### Rate Limiting Logic
```typescript
if (user.lastPasswordResetRequest) {
  const hoursSinceLastRequest =
    (new Date().getTime() - new Date(user.lastPasswordResetRequest).getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastRequest < this.RATE_LIMIT_HOURS) {
    const hoursRemaining = Math.ceil(this.RATE_LIMIT_HOURS - hoursSinceLastRequest);
    throw new BadRequestException(
      `You can only request a password reset once every 24 hours. Please try again in ${hoursRemaining} hour(s).`,
    );
  }
}
```

### Token Expiry Calculation
```typescript
const resetCode = this.generateSixDigitCode(); // e.g., "123456"
const resetTokenExpiry = new Date();
resetTokenExpiry.setMinutes(resetTokenExpiry.getMinutes() + this.TOKEN_EXPIRY_MINUTES);
```

## Testing Recommendations

### 1. Test Email Delivery
```bash
# Use a real email address to test
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test-email@example.com",
    "username": "testuser",
    "password": "TestPass123!"
  }'
```

### 2. Test Password Reset Flow
```bash
# Request reset
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'

# Check email for 6-digit code and reset (within 3 minutes!)
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456",
    "newPassword": "NewPass123!"
  }'
```

### 3. Test Rate Limiting
```bash
# Request reset twice in a row
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'

# Second request should fail with rate limit error
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'
```

### 4. Test Token Expiry
```bash
# Request reset and wait >3 minutes before using code
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'

# Wait 4 minutes...

# Should fail with expired token error
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456",
    "newPassword": "NewPass123!"
  }'
```

## Troubleshooting

### Emails Not Sending
1. Check SendGrid API key is valid
2. Verify SMTP credentials in .env
3. Check application logs for email errors
4. Verify SendGrid account status and quota

### Rate Limit Not Working
1. Verify database column exists:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name='users' AND column_name='last_password_reset_request';
   ```
2. Check if timestamp is being updated correctly

### Token Expiry Issues
1. Verify server time is correct
2. Check token expiry calculation in logs
3. Ensure TOKEN_EXPIRY_MINUTES is set to 3

## Production Checklist

- [ ] Update `FRONTEND_URL` to production domain
- [ ] Verify SendGrid API key is for production account
- [ ] Test email delivery in production environment
- [ ] Monitor email sending logs
- [ ] Set up SendGrid webhooks for bounce/complaint handling
- [ ] Configure DNS records for email authentication (SPF, DKIM, DMARC)
- [ ] Test rate limiting with real usage patterns
- [ ] Set up alerts for failed email sends

## Dependencies Installed
```bash
npm install nodemailer @types/nodemailer --legacy-peer-deps
```

## Files Modified/Created

### Created:
- `src/users/email.service.ts` - Email service with SendGrid integration
- `docs/EMAIL_INTEGRATION.md` - This documentation

### Modified:
- `src/users/users.service.ts` - Added email integration and rate limiting
- `src/users/users.module.ts` - Added EmailService to providers
- `src/database/entities/user.entity.ts` - Added lastPasswordResetRequest field
- `.env` - Added SMTP configuration and FRONTEND_URL

### Database:
- `users` table - Added `last_password_reset_request` column

## Support

For issues or questions:
1. Check application logs for error messages
2. Verify SendGrid dashboard for email delivery status
3. Review this documentation for configuration details
4. Test with curl commands to isolate issues
