# Email Verification & Password Reset Guide

## Overview

The email system uses:
- ✅ **Email Verification**: Clickable button that verifies email and redirects to dashboard
- ✅ **Password Reset**: 6-digit codes that users enter in frontend

## Email Verification Flow

### How It Works

1. User signs up via `/api/v2/auth/signup`
2. System sends verification email with a button
3. User clicks **"Verify Email Address"** button in email
4. Backend verifies the email automatically
5. User is redirected to dashboard at `http://localhost:3000/dashboard?verified=true`
6. Frontend shows success message
7. Done! ✅

### Email Contains

The verification email includes:
- ✅ **Large green "Verify Email Address" button**
- ✅ **Direct link** that handles verification and redirect
- ✅ **Professional design** with ZigScan branding

**When user clicks the button:**
```
1. Email verified ✓
2. Redirected to: http://localhost:3000/dashboard?verified=true&message=Email verified successfully!
```

**If verification fails:**
```
1. Redirected to: http://localhost:3000/login?verified=false&error=Error message
```

## How to Verify Email

### Method 1: Using curl (from email)

After signup, you'll receive an email with a token. Copy the curl command from the email:

```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "your-token-from-email"}'
```

### Method 2: Using Postman/Thunder Client

**POST** `http://localhost:3000/api/v1/auth/verify-email`

Headers:
```
Content-Type: application/json
```

Body (JSON):
```json
{
  "token": "your-token-from-email"
}
```

### Expected Response:
```json
{
  "message": "Email verified successfully. You can now login."
}
```

## How to Reset Password

### Step 1: Request Password Reset

```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

**Response:**
```json
{
  "message": "If the email exists, a 6-digit verification code has been sent to your email."
}
```

### Step 2: Check Your Email

You'll receive an email with:
- A large, prominent **6-digit code** (e.g., 123456)
- Link to your reset page
- Instructions on how to use the code
- 3-minute expiry warning

**Email will look like:**
```
┌─────────────────────────┐
│   YOUR VERIFICATION CODE │
│                          │
│        1 2 3 4 5 6       │
│                          │
└─────────────────────────┘

⚠️ This code expires in 3 minutes!

How to Reset Your Password:
1. Go to: http://localhost:3000/reset-password
2. Enter this 6-digit code: 123456
3. Create your new password and submit
```

### Step 3: Frontend Implementation

Your frontend should have a reset password page that:

1. **Displays input for 6-digit code**
2. **Accepts new password**
3. **Calls API endpoint**

**Example Frontend (React/Next.js):**

```tsx
// pages/reset-password.tsx
import { useState } from 'react';

export default function ResetPassword() {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:3000/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: code,
          newPassword: newPassword
        })
      });
      
      const data = await response.json();
      setMessage(data.message);
      
      if (response.ok) {
        // Redirect to login after 2 seconds
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch (error) {
      setMessage('Failed to reset password');
    }
  };

  return (
    <div>
      <h1>Reset Your Password</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>6-Digit Code from Email:</label>
          <input
            type="text"
            maxLength={6}
            pattern="[0-9]{6}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
          />
        </div>
        <div>
          <label>New Password:</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Reset Password</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
```

### Step 4: API Call for Password Reset

```bash
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456",
    "newPassword": "NewSecurePass123!"
  }'
```

### Expected Response:
```json
{
  "message": "Password reset successful. You can now login with your new password."
}
```

## Important Notes

### Token Format
- **Password Reset**: 6-digit code (e.g., "123456")
- **Email Verification**: Long token (hex string - can be updated to 6-digit if needed)

### Token Expiry
- Email verification tokens: **Never expire** (until used)
- Password reset codes: **3 minutes only** ⏰

### Rate Limiting
- Password reset requests: **Once every 24 hours per email**
- If you try again too soon, you'll get an error like:
  ```json
  {
    "statusCode": 400,
    "message": "You can only request a password reset once every 24 hours. Please try again in 18 hour(s)."
  }
  ```

### Code Format
- Exactly 6 digits (000000-999999)
- Numeric only, no letters
- Easy to read and type
- Displayed prominently in email

## Testing Flow

### Complete User Flow Test:

```bash
# 1. Sign up
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass123!"
  }'

# 2. Check email for verification token

# 3. Verify email (use token from email)
curl -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "token-from-email"}'

# 4. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "TestPass123!"
  }'

# 5. Test password reset
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 6. Check email for reset token (valid for 3 minutes!)

# 7. Reset password (use token from email within 3 minutes)
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "token-from-email",
    "newPassword": "NewPass123!"
  }'

# 8. Login with new password
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "NewPass123!"
  }'
```

## With Frontend Application

If you later add a frontend (React, Next.js, etc.), update `.env`:

```bash
# Change this to your frontend URL
FRONTEND_URL=http://localhost:3001
# or for production
FRONTEND_URL=https://zigscan.org
```

Then emails will include clickable links that open your frontend app.

### Frontend Routes Needed:

Your frontend should have these routes:
- `/verify-email?token=xxx` - Handles email verification
- `/reset-password?token=xxx` - Handles password reset

These routes should call your backend API endpoints with the token from the URL.

## Configuration

### Environment Variables (.env)

```bash
# Backend API URL (for email links to API endpoints)
API_URL=http://localhost:3000

# Frontend URL (if you have a frontend app)
FRONTEND_URL=http://localhost:3000

# For production:
# API_URL=https://api.zigscan.org
# FRONTEND_URL=https://zigscan.org
```

## Email Template Examples

### Verification Email Now Shows:

```
Your Verification Token: abc123...

To verify via API, use this command:

curl -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123..."}'

API Endpoint: http://localhost:3000/api/v1/auth/verify-email
```

### Password Reset Email Now Shows:

```
⚠️ IMPORTANT: This token will expire in 3 MINUTES!

Your reset token: xyz789...

To reset your password via API:

curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "xyz789...", "newPassword": "YourNewPassword123!"}'

API Endpoint: http://localhost:3000/api/v1/auth/reset-password
```

## Troubleshooting

### "404 Not Found" When Clicking Email Link
- **Solution**: Don't click the link - use the curl command from the email instead
- **Or**: Build a frontend application to handle these routes

### "Invalid or expired reset token"
- Check if 3 minutes have passed (tokens expire quickly)
- Make sure you're using the correct token from the latest email
- Request a new reset if needed (wait 24 hours if rate limited)

### "Invalid or expired verification token"
- Double-check the token - copy carefully from email
- Verification tokens don't expire, so timing isn't an issue
- Make sure you haven't already verified (check with login)

### Email Not Arriving
- Check spam/junk folder
- Verify SendGrid sender email is verified (see `docs/SENDGRID_SETUP.md`)
- Check application logs for email sending errors

## API Endpoints Reference

| Endpoint | Method | Purpose | Token Required |
|----------|--------|---------|----------------|
| `/api/v1/auth/signup` | POST | Create account | No |
| `/api/v1/auth/verify-email` | POST | Verify email | No (uses token in body) |
| `/api/v1/auth/login` | POST | Login | No |
| `/api/v1/auth/forgot-password` | POST | Request reset | No |
| `/api/v1/auth/reset-password` | POST | Reset password | No (uses token in body) |
| `/api/v1/auth/profile` | GET | Get profile | Yes (JWT) |

## Summary

✅ **Problem**: Emails had frontend links but no frontend exists  
✅ **Solution**: Emails now show tokens and API curl commands  
✅ **Result**: Users can verify/reset directly via API  
✅ **Bonus**: Ready for frontend integration when needed  

No more 404 errors! 🎉
