# Saved Items API Guide

## Overview
The Saved Items feature allows authenticated users to bookmark and manage blockchain items (contracts, transactions, addresses, validators, etc.) for quick access.

## Authentication Required
**All saved-items endpoints require JWT authentication.** You must include the JWT token in the Authorization header.

---

## Step 1: Login to Get JWT Token

First, you need to authenticate to get your JWT token:

```bash
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "your_username",
    "password": "your_password"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "your_username",
    "email": "your@email.com",
    "isVerified": false,
    "createdAt": "2025-11-01T08:00:00.000Z",
    "lastLogin": "2025-11-01T08:03:45.437Z"
  }
}
```

**Copy the `access_token` value** - you'll use this in all subsequent requests.

---

## Available Endpoints

### 1. **Save an Item** (POST)
Save a blockchain item to your collection.

```bash
curl -X POST http://localhost:3000/api/v2/saved-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "itemSaved": "zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr",
    "itemType": "contract"
  }'
```

**Request Body:**
- `itemSaved` (required): The identifier to save (address, txHash, contract address, etc.)
- `itemType` (optional): Type of item - "contract", "transaction", "address", "validator", "code", etc.

**Response:**
```json
{
  "id": "1",
  "userId": 1,
  "itemSaved": "zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr",
  "itemType": "contract",
  "createdAt": "2025-11-01T08:15:00.000Z"
}
```

**Error Response (if already saved):**
```json
{
  "statusCode": 409,
  "message": "Item already saved",
  "error": "Conflict"
}
```

---

### 2. **Get All Saved Items** (GET)
Retrieve all your saved items with pagination and filtering.

```bash
# Get all saved items (default: limit=20, offset=0)
curl -X GET http://localhost:3000/api/v2/saved-items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# With pagination
curl -X GET "http://localhost:3000/api/v2/saved-items?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by item type
curl -X GET "http://localhost:3000/api/v2/saved-items?itemType=contract&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Query Parameters:**
- `limit` (optional, default: 20): Number of items per page
- `offset` (optional, default: 0): Number of items to skip
- `itemType` (optional): Filter by specific type

**Response:**
```json
{
  "data": [
    {
      "id": "1",
      "userId": 1,
      "itemSaved": "zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr",
      "itemType": "contract",
      "createdAt": "2025-11-01T08:15:00.000Z"
    },
    {
      "id": "2",
      "userId": 1,
      "itemSaved": "ABC123TXHASH",
      "itemType": "transaction",
      "createdAt": "2025-11-01T08:20:00.000Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

### 3. **Get Saved Items Statistics** (GET)
Get counts of saved items grouped by type.

```bash
curl -X GET http://localhost:3000/api/v2/saved-items/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "totalItems": 15,
  "byType": {
    "contract": 5,
    "transaction": 7,
    "address": 2,
    "validator": 1
  }
}
```

---

### 4. **Check if Item is Saved** (GET)
Check if a specific item is already in your saved collection.

```bash
curl -X GET "http://localhost:3000/api/v2/saved-items/check/zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (if saved):**
```json
{
  "isSaved": true,
  "savedItem": {
    "id": "1",
    "userId": 1,
    "itemSaved": "zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr",
    "itemType": "contract",
    "createdAt": "2025-11-01T08:15:00.000Z"
  }
}
```

**Response (if not saved):**
```json
{
  "isSaved": false,
  "savedItem": null
}
```

---

### 5. **Get Single Saved Item by ID** (GET)
Retrieve a specific saved item by its ID.

```bash
curl -X GET http://localhost:3000/api/v2/saved-items/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": "1",
  "userId": 1,
  "itemSaved": "zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr",
  "itemType": "contract",
  "createdAt": "2025-11-01T08:15:00.000Z"
}
```

**Error Response (if not found):**
```json
{
  "statusCode": 404,
  "message": "Saved item not found",
  "error": "Not Found"
}
```

---

### 6. **Delete a Saved Item** (DELETE)
Remove a specific item from your saved collection.

```bash
curl -X DELETE http://localhost:3000/api/v2/saved-items/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "message": "Saved item deleted successfully"
}
```

---

### 7. **Delete All Saved Items** (DELETE)
Remove all saved items from your collection.

```bash
curl -X DELETE http://localhost:3000/api/v2/saved-items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "message": "All saved items deleted successfully",
  "deletedCount": 5
}
```

---

## Common Use Cases

### Use Case 1: Save Multiple Contract Addresses
```bash
# Save first contract
curl -X POST http://localhost:3000/api/v2/saved-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"itemSaved": "zigs1contract1...", "itemType": "contract"}'

# Save second contract
curl -X POST http://localhost:3000/api/v2/saved-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"itemSaved": "zigs1contract2...", "itemType": "contract"}'

# Get all contracts
curl -X GET "http://localhost:3000/api/v2/saved-items?itemType=contract" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Use Case 2: Bookmark Important Transactions
```bash
curl -X POST http://localhost:3000/api/v2/saved-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"itemSaved": "ABC123TXHASH", "itemType": "transaction"}'
```

### Use Case 3: Check Before Saving (Avoid Duplicates)
```bash
# First, check if already saved
ITEM="zigs1contract..."
IS_SAVED=$(curl -s -X GET "http://localhost:3000/api/v2/saved-items/check/$ITEM" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq -r '.isSaved')

if [ "$IS_SAVED" = "false" ]; then
  # Not saved, so save it
  curl -X POST http://localhost:3000/api/v2/saved-items \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d "{\"itemSaved\": \"$ITEM\", \"itemType\": \"contract\"}"
else
  echo "Item already saved"
fi
```

---

## Error Handling

### 401 Unauthorized
Missing or invalid JWT token:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solution:** Make sure you include the Authorization header with a valid JWT token.

### 409 Conflict
Trying to save an item that's already saved:
```json
{
  "statusCode": 409,
  "message": "Item already saved",
  "error": "Conflict"
}
```

**Solution:** Use the `/check/:itemSaved` endpoint first, or handle this error gracefully.

### 404 Not Found
Trying to access or delete a saved item that doesn't exist:
```json
{
  "statusCode": 404,
  "message": "Saved item not found",
  "error": "Not Found"
}
```

---

## Testing in Swagger UI

1. **Open Swagger UI:** http://localhost:3000/api
2. **Authenticate:**
   - Click the "Authorize" button (🔒) at the top
   - Enter your JWT token in the format: `Bearer YOUR_TOKEN`
   - Click "Authorize" then "Close"
3. **Test Endpoints:**
   - All saved-items endpoints will now have the JWT token attached
   - Click "Try it out" on any endpoint
   - Fill in the parameters and click "Execute"

---

## Item Types

Recommended item types for consistency:
- `contract` - Smart contract addresses
- `transaction` - Transaction hashes
- `address` - Wallet addresses
- `validator` - Validator addresses
- `code` - Code IDs
- `block` - Block heights
- `token` - Token identifiers
- `pool` - Liquidity pool IDs

You can use any string value for `itemType`, but using consistent types helps with filtering and organization.

---

## Database Schema

The saved items are stored in the `saved_items` table:

```sql
CREATE TABLE saved_items (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_saved VARCHAR NOT NULL,
  item_type VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  UNIQUE (user_id, item_saved),  -- Prevents duplicates per user
  INDEX idx_user_id (user_id),
  INDEX idx_item_saved (item_saved),
  INDEX idx_created_at (created_at)
);
```

**Key Features:**
- Each user can save the same item only once (unique constraint)
- When a user is deleted, all their saved items are automatically deleted (CASCADE)
- Optimized for fast lookups by user, item, or creation date

---

## Rate Limiting

All endpoints are subject to the global rate limit:
- **10 requests per 60 seconds** per IP address

If you exceed this limit, you'll receive:
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## Tips & Best Practices

1. **Save Early, Access Later:** Save items as you browse, then retrieve them later from `/saved-items`
2. **Use Item Types:** Always include `itemType` for better organization and filtering
3. **Pagination:** Use `limit` and `offset` for large collections
4. **Check First:** Use `/check/:itemSaved` before attempting to save to avoid 409 errors
5. **Stats Dashboard:** Use `/stats` to show users how many items they've saved by type
6. **Search Integration:** Combine with search results to show "Already Saved" indicators

---

## Example: Complete Workflow

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername": "saad", "password": "password123"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Save a contract
curl -X POST http://localhost:3000/api/v2/saved-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "itemSaved": "zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr",
    "itemType": "contract"
  }'

# 3. Save a transaction
curl -X POST http://localhost:3000/api/v2/saved-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "itemSaved": "ABC123TXHASH",
    "itemType": "transaction"
  }'

# 4. Get all saved items
curl -X GET http://localhost:3000/api/v2/saved-items \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Get statistics
curl -X GET http://localhost:3000/api/v2/saved-items/stats \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Check if item is saved
curl -X GET "http://localhost:3000/api/v2/saved-items/check/zigs14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr" \
  -H "Authorization: Bearer $TOKEN" | jq

# 7. Delete a saved item (replace 1 with actual ID)
curl -X DELETE http://localhost:3000/api/v2/saved-items/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Frontend Integration Example (JavaScript)

```javascript
// Store token after login
const token = 'YOUR_JWT_TOKEN';

// Save an item
async function saveItem(itemSaved, itemType) {
  const response = await fetch('http://localhost:3000/api/v2/saved-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ itemSaved, itemType })
  });
  
  if (response.ok) {
    console.log('Item saved successfully');
  } else if (response.status === 409) {
    console.log('Item already saved');
  }
}

// Check if item is saved (for UI indicators)
async function checkIfSaved(itemSaved) {
  const response = await fetch(
    `http://localhost:3000/api/v2/saved-items/check/${encodeURIComponent(itemSaved)}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  return data.isSaved;
}

// Get all saved items with pagination
async function getSavedItems(limit = 20, offset = 0, itemType = null) {
  const params = new URLSearchParams({ limit, offset });
  if (itemType) params.append('itemType', itemType);
  
  const response = await fetch(
    `http://localhost:3000/api/v2/saved-items?${params}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return await response.json();
}

// Delete saved item
async function deleteSavedItem(id) {
  const response = await fetch(
    `http://localhost:3000/api/v2/saved-items/${id}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (response.ok) {
    console.log('Item deleted successfully');
  }
}

// Usage examples
await saveItem('zigs1contract...', 'contract');
const isSaved = await checkIfSaved('zigs1contract...');
const savedItems = await getSavedItems(10, 0, 'contract');
await deleteSavedItem(1);
```

---

## Support

For issues or questions:
- Check the Swagger UI documentation at http://localhost:3000/api
- Review error messages for specific guidance
- Ensure your JWT token is valid (tokens expire after 24 hours)
