# User Authentication Module

## Overview
Secure user authentication system with signup, login, email verification, and password reset functionality.

## Security Features

### Password Security
- **bcrypt hashing** with 12 salt rounds
- **Strong password requirements**:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (@$!%*?&)

### Input Validation
- Email format validation
- Username validation (3-50 characters, alphanumeric + underscores)
- Sanitized inputs to prevent SQL injection
- Rate limiting recommended (implement at API gateway level)

### Token Security
- Secure random tokens (64 hex characters)
- Token expiration (24 hours for password reset)
- Tokens stored hashed in database
- One-time use tokens

### Additional Security Measures
- Passwords never included in responses
- Generic error messages to prevent user enumeration
- Last login tracking
- Email verification system

## API Endpoints

### 1. User Signup
**POST** `/api/v2/auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "userId": "1"
}
```

**Status Codes:**
- `201`: Successfully created
- `409`: Email or username already exists
- `400`: Invalid input data

---

### 2. User Login
**POST** `/api/v2/auth/login`

**Request Body:**
```json
{
  "identifier": "john_doe",  // username or email
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "1",
    "username": "john_doe",
    "email": "user@example.com",
    "isVerified": true
  },
  "token": "abc123...xyz789"
}
```

**Status Codes:**
- `200`: Successfully authenticated
- `401`: Invalid credentials

---

### 3. Verify Email
**POST** `/api/v2/auth/verify-email`

**Request Body:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response:**
```json
{
  "message": "Email verified successfully. You can now login."
}
```

**Status Codes:**
- `200`: Successfully verified
- `400`: Invalid or expired token

---

### 4. Forgot Password
**POST** `/api/v2/auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent."
}
```

**Status Codes:**
- `200`: Request processed (always returns 200 for security)

---

### 5. Reset Password
**POST** `/api/v2/auth/reset-password`

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "message": "Password reset successful. You can now login with your new password."
}
```

**Status Codes:**
- `200`: Successfully reset
- `400`: Invalid or expired token

---

### 6. Get User Profile
**GET** `/api/v2/auth/profile`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": "1",
  "username": "john_doe",
  "email": "user@example.com",
  "createdAt": "2025-11-01T11:00:00Z",
  "lastLogin": "2025-11-01T12:00:00Z",
  "isVerified": true
}
```

**Status Codes:**
- `200`: Successfully retrieved
- `401`: Unauthorized (invalid or missing token)
- `404`: User not found

---

## Testing with Postman/cURL

### Signup Example
```bash
curl -X POST http://localhost:3000/api/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass123!"
  }'
```

### Login Example
```bash
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "TestPass123!"
  }'
```

### Get Profile Example
```bash
curl -X GET http://localhost:3000/api/v2/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Database Schema

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expiry TIMESTAMP
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE UNIQUE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_created_at ON users (created_at);
CREATE INDEX idx_users_last_login ON users (last_login);
```

---

## TODO: Additional Security Improvements

### 1. Implement JWT Tokens
Currently using simple tokens. Upgrade to JWT for better security:

```bash
npm install @nestjs/jwt passport-jwt
npm install --save-dev @types/passport-jwt
```

### 2. Add Rate Limiting
Protect against brute force attacks:

```bash
npm install @nestjs/throttler
```

### 3. Email Service Integration
Currently email sending is commented out. Integrate an email service:
- SendGrid
- AWS SES
- Mailgun
- Nodemailer

### 4. Two-Factor Authentication (2FA)
Add TOTP-based 2FA:

```bash
npm install speakeasy qrcode
```

### 5. Session Management
Add session management with Redis:
- Track active sessions
- Allow users to logout from all devices
- Session expiration

### 6. Account Lockout
After multiple failed login attempts:
- Lock account temporarily
- Send notification email
- Require captcha or email verification to unlock

### 7. Security Headers
Add helmet middleware:

```bash
npm install helmet
```

### 8. CORS Configuration
Configure CORS properly for production:
- Whitelist specific origins
- Disable credentials for public APIs

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

---

## Best Practices Implemented

✅ Password hashing with bcrypt  
✅ Input validation with class-validator  
✅ Secure token generation  
✅ Generic error messages (prevents user enumeration)  
✅ Email verification system  
✅ Password reset with expiration  
✅ TypeORM entities with proper indexes  
✅ Separation of concerns (Controller → Service → Repository)  
✅ Swagger/OpenAPI documentation  
✅ Proper HTTP status codes  

---

## Environment Variables

Make sure these are set in your `.env` file:

```properties
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=saad_test_db

# JWT Configuration (when implemented)
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=1d

# Email Configuration (when implemented)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## Swagger Documentation

Once the application is running, visit:
http://localhost:3000/docs

You'll see all the authentication endpoints with interactive testing capability.

---

## Support

For issues or questions, please contact the development team.
