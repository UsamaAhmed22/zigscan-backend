# Postman Authentication Requests Guide

Complete guide for testing all authentication endpoints in Postman.

## Base URL

```
http://localhost:3000
```

## Environment Variables (Optional)

Create these variables in Postman for easier testing:

| Variable | Value | Description |
|----------|-------|-------------|
| `baseUrl` | `http://localhost:3000` | API base URL |
| `accessToken` | (auto-set after login) | JWT token |
| `verificationToken` | (copy from email) | Email verification token |
| `resetCode` | (copy from email) | 6-digit reset code |

---

## 1. User Signup

**Register a new user account**

### Request
```
POST {{baseUrl}}/api/v2/auth/signup
```

### Headers
```
Content-Type: application/json
```

### Body (JSON)
```json
{
  "email": "test@example.com",
  "username": "testuser",
  "password": "TestPass123!"
}
```

### Expected Response (201)
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "userId": "1"
}
```

### Expected Errors
- **409 Conflict**: Email or username already exists
- **400 Bad Request**: Invalid input (weak password, invalid email)

### Notes
- Password must be at least 8 characters
- Username must be 3-50 characters
- Email must be valid format
- Check your email inbox for verification code

---

## 2. Verify Email

**Verify email address - Two methods available**

### Method A: Via Email Link (Production - Recommended)

Users click the "Verify Email Address" button in their email, which:
1. Automatically verifies the email
2. Redirects to dashboard with success message

```
GET {{baseUrl}}/api/v2/auth/verify-email-redirect?token={token}&redirect={redirectUrl}
```

**Success Redirect**:
```
http://localhost:3000/dashboard?verified=true&message=Email%20verified%20successfully!
```

**Error Redirect**:
```
http://localhost:3000/login?verified=false&error=Invalid%20or%20expired%20token
```

**Frontend Requirements**:
- Dashboard page must handle `?verified=true&message=` query params
- Login page must handle `?verified=false&error=` query params

---

### Method B: Via API Endpoint (Testing Only)

For testing purposes, you can verify email directly via API:

### Request
```
POST {{baseUrl}}/api/v2/auth/verify-email
```

### Headers
```
Content-Type: application/json
```

### Body (JSON)
```json
{
  "token": "abc123def456..."
}
```

### Expected Response (200)
```json
{
  "message": "Email verified successfully. You can now login."
}
```

### Expected Errors
- **400 Bad Request**: Invalid or expired verification token
- **400 Bad Request**: Email already verified

### Notes
- In production, users should click the email button (Method A)
- This API endpoint is for testing without checking emails
- Token doesn't expire (until used)

---

## 3. User Login

**Login and receive JWT access token**

### Request
```
POST {{baseUrl}}/api/v2/auth/login
```

### Headers
```
Content-Type: application/json
```

### Body (JSON)
```json
{
  "identifier": "testuser",
  "password": "TestPass123!"
}
```

**Alternative (login with email):**
```json
{
  "identifier": "test@example.com",
  "password": "TestPass123!"
}
```

### Expected Response (200)
```json
{
  "message": "Login successful",
  "user": {
    "id": "1",
    "username": "testuser",
    "email": "test@example.com",
    "isVerified": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

### Expected Errors
- **401 Unauthorized**: Invalid credentials
- **401 Unauthorized**: Email not verified (if enforced)

### Notes
- Save the `accessToken` from response
- Use this token in `Authorization` header for protected routes
- Token expires in 24 hours

### Postman Test Script (Auto-save token)
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("accessToken", response.accessToken);
    console.log("Access token saved:", response.accessToken);
}
```

---

## 4. Get User Profile

**Get current user's profile information**

### Request
```
GET {{baseUrl}}/api/v2/auth/profile
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "id": "1",
  "email": "test@example.com",
  "username": "testuser",
  "createdAt": "2025-11-05T12:00:00.000Z",
  "lastLogin": "2025-11-05T14:30:00.000Z",
  "isVerified": true
}
```

### Expected Errors
- **401 Unauthorized**: Missing or invalid token

### Notes
- Requires valid JWT token in Authorization header

---

## 5. Get Active Sessions

**View all active login sessions**

### Request
```
GET {{baseUrl}}/api/v2/auth/sessions
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "total": 2,
  "sessions": [
    {
      "loginTime": "2025-11-05T14:30:00.000Z",
      "lastActivity": "2025-11-05T14:35:00.000Z",
      "ipAddress": "192.168.1.1",
      "userAgent": "PostmanRuntime/7.32.3"
    },
    {
      "loginTime": "2025-11-05T10:00:00.000Z",
      "lastActivity": "2025-11-05T10:15:00.000Z",
      "ipAddress": "192.168.1.2",
      "userAgent": "Mozilla/5.0..."
    }
  ]
}
```

### Expected Errors
- **401 Unauthorized**: Missing or invalid token

### Notes
- Shows all devices/locations where user is logged in
- Useful for security monitoring

---

## 6. Logout (Current Session)

**Logout from current session only**

### Request
```
POST {{baseUrl}}/api/v2/auth/logout
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "message": "Logout successful"
}
```

### Expected Errors
- **401 Unauthorized**: Missing or invalid token

### Notes
- Invalidates only the current access token
- Other sessions remain active

---

## 7. Logout All Devices

**Logout from all sessions/devices**

### Request
```
POST {{baseUrl}}/api/v2/auth/logout-all
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "message": "Logged out from all devices successfully"
}
```

### Expected Errors
- **401 Unauthorized**: Missing or invalid token

### Notes
- Invalidates ALL access tokens for this user
- Useful if device was lost or compromised

---

## 8. Forgot Password

**Request password reset with 6-digit code**

### Request
```
POST {{baseUrl}}/api/v2/auth/forgot-password
```

### Headers
```
Content-Type: application/json
```

### Body (JSON)
```json
{
  "email": "test@example.com"
}
```

### Expected Response (200)
```json
{
  "message": "If the email exists, a 6-digit verification code has been sent to your email."
}
```

### Expected Errors
- **400 Bad Request**: Rate limited (must wait 24 hours)
  ```json
  {
    "statusCode": 400,
    "message": "You can only request a password reset once every 24 hours. Please try again in 18 hour(s)."
  }
  ```

### Notes
- Always returns success (doesn't reveal if email exists)
- Check email for 6-digit code (e.g., 123456)
- Code expires in 3 minutes
- Can only request once every 24 hours

---

## 9. Reset Password

**Reset password using 6-digit code from email**

### Request
```
POST {{baseUrl}}/api/v2/auth/reset-password
```

### Headers
```
Content-Type: application/json
```

### Body (JSON)
```json
{
  "token": "123456",
  "newPassword": "NewSecurePass123!"
}
```

### Expected Response (200)
```json
{
  "message": "Password reset successful. You can now login with your new password."
}
```

### Expected Errors
- **400 Bad Request**: Invalid or expired reset token
  ```json
  {
    "statusCode": 400,
    "message": "Invalid or expired reset token"
  }
  ```
- **400 Bad Request**: Reset token has expired (>3 minutes)
  ```json
  {
    "statusCode": 400,
    "message": "Reset token has expired. Please request a new one."
  }
  ```

### Notes
- Token is the 6-digit code from email (e.g., "123456")
- Code expires in 3 minutes
- New password must meet requirements (min 8 characters)

---

## 10. Delete Account

**Permanently delete user account**

### Request
```
DELETE {{baseUrl}}/api/v2/auth/account
```

### Headers
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

### Body (JSON)
```json
{
  "password": "TestPass123!"
}
```

### Expected Response (200)
```json
{
  "message": "Your account has been permanently deleted. All your data has been removed."
}
```

### Expected Errors
- **401 Unauthorized**: Missing or invalid token
- **401 Unauthorized**: Invalid password
  ```json
  {
    "statusCode": 401,
    "message": "Invalid password. Account deletion cancelled."
  }
  ```
- **404 Not Found**: User not found

### Notes
- Requires password confirmation for security
- Permanently deletes user and all related data (saved items)
- Cannot be undone
- Automatically logs out from all devices

---

## Saved Items Endpoints

All saved items endpoints require JWT authentication.

### 11. Create Saved Item

**Save a new item**

### Request
```
POST {{baseUrl}}/api/v2/saved-items
```

### Headers
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

### Body (JSON)
```json
{
  "itemSaved": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "itemType": "address",
  "label": "My Wallet"
}
```

**Item Types:** `address`, `transaction`, `block`, `token`, `contract`

### Expected Response (201)
```json
{
  "id": "1",
  "itemSaved": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "itemType": "address",
  "label": "My Wallet",
  "createdAt": "2025-11-05T14:30:00.000Z"
}
```

### Expected Errors
- **401 Unauthorized**: Missing or invalid token
- **409 Conflict**: Item already saved

---

### 12. Get All Saved Items

**Retrieve all saved items with pagination**

### Request
```
GET {{baseUrl}}/api/v2/saved-items?page=1&limit=10&itemType=address
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 10 | Items per page |
| `itemType` | string | No | - | Filter by type |

### Expected Response (200)
```json
{
  "data": [
    {
      "id": "1",
      "itemSaved": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "itemType": "address",
      "label": "My Wallet",
      "createdAt": "2025-11-05T14:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### 13. Get Saved Items Stats

**Get statistics about saved items**

### Request
```
GET {{baseUrl}}/api/v2/saved-items/stats
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "total": 15,
  "byType": {
    "address": 5,
    "transaction": 7,
    "block": 2,
    "contract": 1
  }
}
```

---

### 14. Check if Item is Saved

**Check if specific item is already saved**

### Request
```
GET {{baseUrl}}/api/v2/saved-items/check/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "itemSaved": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "isSaved": true
}
```

---

### 15. Get Saved Item by ID

**Get specific saved item details**

### Request
```
GET {{baseUrl}}/api/v2/saved-items/1
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "id": "1",
  "itemSaved": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "itemType": "address",
  "label": "My Wallet",
  "createdAt": "2025-11-05T14:30:00.000Z"
}
```

### Expected Errors
- **404 Not Found**: Saved item not found

---

### 16. Delete Saved Item

**Delete specific saved item**

### Request
```
DELETE {{baseUrl}}/api/v2/saved-items/1
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "message": "Saved item deleted successfully"
}
```

### Expected Errors
- **404 Not Found**: Saved item not found

---

### 17. Delete All Saved Items

**Delete all saved items for user**

### Request
```
DELETE {{baseUrl}}/api/v2/saved-items
```

### Headers
```
Authorization: Bearer {{accessToken}}
```

### Expected Response (200)
```json
{
  "message": "All saved items deleted successfully",
  "deletedCount": 15
}
```

---

## Complete Testing Flow

### Scenario 1: New User Registration and Login

```
1. POST /api/v2/auth/signup
2. Check email for verification token
3. POST /api/v2/auth/verify-email (with token)
4. POST /api/v2/auth/login (save accessToken)
5. GET /api/v2/auth/profile (with accessToken)
```

### Scenario 2: Password Reset Flow

```
1. POST /api/v2/auth/forgot-password
2. Check email for 6-digit code
3. POST /api/v2/auth/reset-password (with code, within 3 minutes)
4. POST /api/v2/auth/login (with new password)
```

### Scenario 3: Saved Items Management

```
1. POST /api/v2/auth/login (get accessToken)
2. POST /api/v2/saved-items (create item)
3. GET /api/v2/saved-items (list all)
4. GET /api/v2/saved-items/stats
5. GET /api/v2/saved-items/check/{item}
6. DELETE /api/v2/saved-items/{id}
```

### Scenario 4: Session Management

```
1. POST /api/v2/auth/login (from device 1)
2. POST /api/v2/auth/login (from device 2)
3. GET /api/v2/auth/sessions (see both sessions)
4. POST /api/v2/auth/logout-all (logout everywhere)
5. GET /api/v2/auth/profile (should fail - 401)
```

---

## Import Postman Collection

You can create a Postman collection with these requests or import this JSON:

### Postman Collection JSON

Save this as `ZigScan_Auth_API.postman_collection.json`:

```json
{
  "info": {
    "name": "ZigScan Authentication API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ],
  "item": [
    {
      "name": "1. Signup",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"test@example.com\",\n  \"username\": \"testuser\",\n  \"password\": \"TestPass123!\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v2/auth/signup",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v2", "auth", "signup"]
        }
      }
    },
    {
      "name": "2. Verify Email",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"token\": \"{{verificationToken}}\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v2/auth/verify-email",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v2", "auth", "verify-email"]
        }
      }
    },
    {
      "name": "3. Login",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 200) {",
              "    const response = pm.response.json();",
              "    pm.environment.set(\"accessToken\", response.accessToken);",
              "}"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"identifier\": \"testuser\",\n  \"password\": \"TestPass123!\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v2/auth/login",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v2", "auth", "login"]
        }
      }
    },
    {
      "name": "4. Get Profile",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/v2/auth/profile",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v2", "auth", "profile"]
        }
      }
    },
    {
      "name": "5. Forgot Password",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"test@example.com\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v2/auth/forgot-password",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v2", "auth", "forgot-password"]
        }
      }
    },
    {
      "name": "6. Reset Password",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"token\": \"{{resetCode}}\",\n  \"newPassword\": \"NewPass123!\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v2/auth/reset-password",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v2", "auth", "reset-password"]
        }
      }
    }
  ]
}
```

---

## Tips for Testing

### 1. Setup Environment
- Create a new environment in Postman
- Add `baseUrl` variable
- Add `accessToken` variable (will auto-populate)

### 2. Auto-Save JWT Token
Add this to Login request's **Tests** tab:
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("accessToken", response.accessToken);
    console.log("✅ Token saved successfully");
}
```

### 3. Test Rate Limiting
```
1. Send forgot-password request
2. Wait 1 minute
3. Send forgot-password request again
4. Should get: "Please try again in 23 hour(s)"
```

### 4. Test Token Expiry
```
1. Send forgot-password request
2. Note the 6-digit code
3. Wait 4 minutes
4. Try to reset password with that code
5. Should get: "Reset token has expired"
```

### 5. Use Console Logs
Add to test scripts:
```javascript
console.log("Response:", pm.response.json());
console.log("Status:", pm.response.code);
```

---

## Common Issues

### 401 Unauthorized
- Check if JWT token is in Authorization header
- Verify token format: `Bearer <token>`
- Token might be expired (24h validity)
- Try logging in again

### 400 Bad Request
- Check JSON syntax
- Verify all required fields
- Check field validation (email format, password strength)

### 409 Conflict
- Email/username already exists
- Item already saved
- Try different values

### Rate Limiting Error
- Wait for the specified time
- Or use a different email address for testing

---

## Quick Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v2/auth/signup` | POST | None | Register |
| `/api/v2/auth/login` | POST | None | Login |
| `/api/v2/auth/verify-email` | POST | None | Verify email |
| `/api/v2/auth/forgot-password` | POST | None | Request reset |
| `/api/v2/auth/reset-password` | POST | None | Reset password |
| `/api/v2/auth/profile` | GET | JWT | Get profile |
| `/api/v2/auth/sessions` | GET | JWT | List sessions |
| `/api/v2/auth/logout` | POST | JWT | Logout current |
| `/api/v2/auth/logout-all` | POST | JWT | Logout all |
| `/api/v2/auth/account` | DELETE | JWT | Delete account |
| `/api/v2/saved-items` | POST | JWT | Save item |
| `/api/v2/saved-items` | GET | JWT | List items |
| `/api/v2/saved-items/:id` | GET | JWT | Get item |
| `/api/v2/saved-items/:id` | DELETE | JWT | Delete item |

🚀 Happy Testing!
