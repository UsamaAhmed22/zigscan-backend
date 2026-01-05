# SendGrid Sender Verification Guide

## Current Issue

```
Error: Message failed: 550 The from address does not match a verified Sender Identity.
```

**Reason**: SendGrid requires you to verify the "from" email address before you can send emails.

## Solution: Verify Your Sender Email in SendGrid

### Option 1: Single Sender Verification (Recommended for Testing)

1. **Go to SendGrid Dashboard**
   - Visit: https://app.sendgrid.com/
   - Login with your SendGrid account

2. **Navigate to Sender Authentication**
   - Click on **Settings** in the left sidebar
   - Click on **Sender Authentication**

3. **Verify a Single Sender**
   - Click **"Verify a Single Sender"**
   - Fill in the form:
     - **From Name**: ZIGScan (or DegenTer Bot)
     - **From Email Address**: `info@zigscan.org` (or the email you want to use)
     - **Reply To**: Same as "From Email" or different if needed
     - **Company Address**: Your company address
     - **Nickname**: ZIGScan Notifications

4. **Check Your Email**
   - SendGrid will send a verification email to `info@zigscan.org`
   - Click the verification link in that email
   - Once verified, you can send emails from that address

### Option 2: Domain Authentication (Recommended for Production)

If you own the domain (e.g., `zigscan.org` or `degenter.io`):

1. **Go to Sender Authentication**
   - Settings → Sender Authentication

2. **Authenticate Your Domain**
   - Click **"Authenticate Your Domain"**
   - Select your DNS host provider
   - Follow instructions to add DNS records (CNAME records)

3. **Add DNS Records**
   - You'll need to add 3 CNAME records to your domain's DNS:
     - `s1._domainkey.yourdomain.com`
     - `s2._domainkey.yourdomain.com`
     - `em1234.yourdomain.com` (subdomain varies)

4. **Verify DNS Records**
   - After adding DNS records, click **"Verify"** in SendGrid
   - Once verified, you can send from any email address at that domain

### Temporary Solution: Use Your Personal Email

If you don't have access to `info@zigscan.org` or can't verify the domain right now:

1. **Update `.env` file** to use an email address you control:

```bash
# Use your personal email that you can verify
SMTP_FROM="ZIGScan <your-email@gmail.com>"
# or
SMTP_FROM="ZIGScan <saadbeenco@gmail.com>"
```

2. **Verify that email in SendGrid**
   - Follow "Option 1" above to verify your personal email
   - SendGrid will send verification to your email
   - Click the link to verify

3. **Restart your application** after updating .env

## Current Configuration

Your current settings in `.env`:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=apikey
SMTP_PASS=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
SMTP_FROM="ZIGScan <info@zigscan.org>"  # ⚠️ This needs to be verified!
```

## Verification Checklist

- [ ] Login to SendGrid dashboard
- [ ] Go to Settings → Sender Authentication
- [ ] Verify a Single Sender OR Authenticate Domain
- [ ] Check email inbox for verification link
- [ ] Click verification link
- [ ] Wait for confirmation (usually instant)
- [ ] Test sending email from your app
- [ ] Update `.env` if using different email address

## Testing After Verification

Once verified, test the password reset flow:

```bash
# Test password reset
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "saadbeenco@gmail.com"}'
```

Check your email inbox - you should receive the password reset email within seconds.

## Common Issues

### Issue: "Verification email not received"
- Check spam/junk folder
- Make sure you entered the correct email address
- Try resending verification from SendGrid dashboard

### Issue: "Domain verification failing"
- DNS changes can take 24-48 hours to propagate
- Use `dig` or online DNS checkers to verify CNAME records are live
- Make sure you added ALL 3 CNAME records exactly as shown

### Issue: "Still getting 550 error after verification"
- Make sure the email in `.env` EXACTLY matches the verified email
- Check for typos or extra spaces
- Restart your application after updating .env
- Clear any email sending caches

## Production Best Practices

For production deployment:

1. **Use Domain Authentication** instead of single sender
   - More professional
   - Better deliverability
   - Can use any email @yourdomain.com

2. **Set up DMARC, SPF, DKIM**
   - SendGrid provides these automatically with domain authentication
   - Improves email deliverability
   - Reduces chance of emails going to spam

3. **Use Professional Email**
   - `no-reply@yourdomain.com` for system emails
   - `support@yourdomain.com` for user support
   - Avoid using free email providers (gmail, yahoo) in production

4. **Monitor Email Reputation**
   - Check SendGrid dashboard for bounce rates
   - Monitor spam complaints
   - Keep bounce rate < 5%

## Support Links

- SendGrid Sender Authentication: https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication
- Verify Single Sender: https://docs.sendgrid.com/ui/sending-email/sender-verification
- DNS Configuration: https://docs.sendgrid.com/ui/account-and-settings/dns-records

## Quick Fix Right Now

**Fastest way to test immediately:**

1. Change `.env`:
   ```bash
   SMTP_FROM="saadbeenco@gmail.com"
   ```

2. Go to SendGrid and verify `saadbeenco@gmail.com`

3. Restart your app

4. Test again

This way you can use your own email that you have access to for immediate testing!
