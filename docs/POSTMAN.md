# ZigScan API - Postman Setup Guide

## 1. Import API into Postman

### Option A: Import from OpenAPI Spec

1. Open Postman
2. Click **Import** → **Link**
3. Enter: `http://localhost:8001/openapi.json`
4. Click **Continue** → **Import**

### Option B: Manual Setup

Create a new collection called "ZigScan API" with these requests:

## 2. Set Up Authentication

### Create Environment Variables

1. Click **Environments** → **Create Environment**
2. Name it "ZigScan Local"
3. Add variables:
   - `base_url`: `http://localhost:8001`
   - `api_key`: `zigscan-default-key` (or your custom key)

### Configure Collection Authorization

1. Select your "ZigScan API" collection
2. Go to **Authorization** tab
3. Type: **Bearer Token**
4. Token: `{{api_key}}`

This will automatically add the Bearer token to all requests in the collection.

## 3. API Endpoints

### Public Endpoints (No Auth Required)

#### Health Check

```
GET {{base_url}}/api/v2/health
```

### Protected Endpoints (Require API Key)

#### 1. Transaction Statistics

```
GET {{base_url}}/api/v2/stats
Authorization: Bearer {{api_key}}
```

#### 2. Contract Instantiations

```
GET {{base_url}}/api/v2/contracts?limit=10&offset=0
Authorization: Bearer {{api_key}}
```

#### 3. Code Store Events

```
GET {{base_url}}/api/v2/codes?limit=10&offset=0
Authorization: Bearer {{api_key}}
```

#### 4. Custom Query

```
GET {{base_url}}/api/v2/query?sql=SELECT * FROM blocks LIMIT 5
Authorization: Bearer {{api_key}}
```

#### 5. API Usage Statistics

```
GET {{base_url}}/api/v2/usage
Authorization: Bearer {{api_key}}
```

## 4. Example Requests

### Get Recent Contracts

```bash
# Method: GET
# URL: {{base_url}}/api/v2/contracts
# Headers: Authorization: Bearer {{api_key}}
# Params:
#   - limit: 20
#   - offset: 0
```

### Custom ClickHouse Query

```bash
# Method: GET
# URL: {{base_url}}/api/v2/query
# Headers: Authorization: Bearer {{api_key}}
# Params:
#   - sql: SELECT height, tx_hash FROM txs ORDER BY height DESC LIMIT 10
#   - limit: 100
```

## 5. Error Handling

### 401 Unauthorized

```json
{
  "detail": "Invalid API key"
}
```

**Solution**: Check your API key in environment variables

### 429 Rate Limited

```json
{
  "detail": "Rate limit exceeded. Max 100 requests per 60 seconds."
}
```

**Solution**: Wait 60 seconds or use a different API key

### 400 Bad Request (Custom Query)

```json
{
  "detail": "Only SELECT queries are allowed"
}
```

**Solution**: Ensure your SQL starts with SELECT

## 6. Rate Limiting

- **Limit**: 100 requests per 60 seconds per API key
- **Headers**: Check `Retry-After` header when rate limited
- **Monitoring**: Use `/api/v2/usage` endpoint to track usage

## 7. Response Format

### Successful Response

```json
{
  "data": [...],
  "total_count": 25
}
```

### Error Response

```json
{
  "detail": "Error message"
}
```

## 8. Testing Collection

Create a **Test Collection** with these pre-configured requests:

1. **Health Check** (Public)
2. **Get Stats** (Protected)
3. **List Contracts** (Protected, limit=5)
4. **List Codes** (Protected, limit=5)
5. **Usage Stats** (Protected)
6. **Custom Query** (Protected, sample query)

## 9. Environment Setup

### Local Development

```
base_url: http://localhost:8001
api_key: zigscan-default-key
```

### Production

```
base_url: https://your-production-domain.com
api_key: your-production-api-key
```

## 10. Automation & Scripts

### Pre-request Script (Collection Level)

```javascript
// Auto-set timestamp for requests
pm.globals.set("timestamp", new Date().toISOString());
```

### Test Script Example

```javascript
// Test for successful response
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response has data", function () {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property("data");
});
```
