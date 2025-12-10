# 5xx Toast Deduplication Test Guide

## 📋 Overview

This document provides a complete testing solution to verify the 5xx error toast deduplication mechanism implemented in `ErrorToastContainer.tsx`.

The goal is to simulate the production incident where Cloudflare outage caused toast spam (as shown in the screenshot with multiple "Server error" toasts).

---

## 🎯 What We're Testing

**Problem**: When Cloudflare went down, multiple concurrent API requests returned 5xx errors, causing the app to display dozens of identical "Server error" toasts.

**Solution**: Implemented force deduplication for:
- `403` Forbidden
- `429` Rate Limiting
- `5xx` Server Errors (500-599)

**Expected Result**: All 5xx errors should show only **1 toast** with `toastId = 'error_5xx'`, regardless of how many concurrent requests fail.

---

## 🚀 Test Server Implementation

### Project Structure

```
test-5xx-toast/
├── package.json
├── server.js          # Simulates Cloudflare 503 server
└── test-client.html   # Test client to trigger batch requests
```

---

### 1. `package.json`

```json
{
  "name": "test-5xx-toast",
  "version": "1.0.0",
  "description": "Test server for simulating Cloudflare 503 errors",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
```

---

### 2. `server.js` - Mock Cloudflare 503 Server

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3456;

// Enable CORS for testing from OneKey App
app.use(cors());

// Cloudflare 503 HTML page (1:1 replica)
const CLOUDFLARE_503_HTML = `
<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=Edge">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Service Unavailable</title>
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 {
      color: #f38020;
      font-size: 32px;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .error-code {
      color: #999;
      font-size: 14px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>503 Service Temporarily Unavailable</h1>
    <p>The server is temporarily unable to service your request due to maintenance downtime or capacity problems. Please try again later.</p>
    <p class="error-code">Cloudflare Ray ID: 8a3b4c5d6e7f8901</p>
  </div>
</body>
</html>
`;

// Mock different 5xx errors
app.get('/api/test-503', (req, res) => {
  console.log('📡 Received request for /api/test-503');
  res.status(503)
     .set('Content-Type', 'text/html')
     .send(CLOUDFLARE_503_HTML);
});

app.get('/api/test-502', (req, res) => {
  console.log('📡 Received request for /api/test-502');
  res.status(502)
     .set('Content-Type', 'text/html')
     .send(CLOUDFLARE_503_HTML.replace('503', '502').replace('Service Temporarily Unavailable', 'Bad Gateway'));
});

app.get('/api/test-500', (req, res) => {
  console.log('📡 Received request for /api/test-500');
  res.status(500)
     .set('Content-Type', 'text/html')
     .send(CLOUDFLARE_503_HTML.replace('503', '500').replace('Service Temporarily Unavailable', 'Internal Server Error'));
});

// Static file serving (for test client)
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`\n🚀 Test server running at http://localhost:${PORT}`);
  console.log(`\n📍 Test endpoints:`);
  console.log(`   - http://localhost:${PORT}/api/test-503 (Cloudflare 503)`);
  console.log(`   - http://localhost:${PORT}/api/test-502 (Cloudflare 502)`);
  console.log(`   - http://localhost:${PORT}/api/test-500 (Cloudflare 500)`);
  console.log(`\n📱 Open http://localhost:${PORT}/test-client.html in browser to trigger batch requests\n`);
});
```

---

### 3. `test-client.html` - Test Client

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>5xx Toast Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    button {
      background: #f38020;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
      margin: 10px 5px;
      transition: background 0.2s;
    }
    button:hover {
      background: #d66d1a;
    }
    button:active {
      transform: scale(0.98);
    }
    .status {
      margin-top: 20px;
      padding: 15px;
      background: #f0f0f0;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
      max-height: 400px;
      overflow-y: auto;
    }
    .instructions {
      background: #fffbea;
      border-left: 4px solid #f38020;
      padding: 15px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 5xx Toast Deduplication Test</h1>

    <div class="instructions">
      <strong>Test Steps:</strong>
      <ol>
        <li>Ensure OneKey App is running</li>
        <li>Click buttons below to trigger batch requests</li>
        <li>Observe the number of toasts in the app</li>
        <li><strong>Expected Result</strong>: Only 1 "Server error" toast (not 10)</li>
      </ol>
    </div>

    <h3>Trigger Tests</h3>
    <button onclick="triggerBatch503()">🔥 Trigger 10x 503 Errors</button>
    <button onclick="triggerBatch502()">🔥 Trigger 10x 502 Errors</button>
    <button onclick="triggerMixed5xx()">🔥 Trigger Mixed 5xx Errors (502+503+500)</button>

    <div class="status" id="status">Waiting for test...</div>
  </div>

  <script>
    const BASE_URL = 'http://localhost:3456';
    const statusEl = document.getElementById('status');

    function log(msg) {
      const timestamp = new Date().toLocaleTimeString();
      statusEl.innerHTML += `\n[${timestamp}] ${msg}`;
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    async function triggerBatch503() {
      statusEl.innerHTML = '🚀 Triggering 10x 503 requests...\n';

      const promises = [];
      for (let i = 1; i <= 10; i++) {
        promises.push(
          fetch(`${BASE_URL}/api/test-503`)
            .then(res => {
              log(`Request ${i}: ${res.status} ${res.statusText}`);
              return res.text();
            })
            .catch(err => log(`Request ${i}: ❌ ${err.message}`))
        );
      }

      await Promise.all(promises);
      log('\n✅ All requests completed! Check OneKey App for toast count.');
    }

    async function triggerBatch502() {
      statusEl.innerHTML = '🚀 Triggering 10x 502 requests...\n';

      const promises = [];
      for (let i = 1; i <= 10; i++) {
        promises.push(
          fetch(`${BASE_URL}/api/test-502`)
            .then(res => {
              log(`Request ${i}: ${res.status} ${res.statusText}`);
              return res.text();
            })
            .catch(err => log(`Request ${i}: ❌ ${err.message}`))
        );
      }

      await Promise.all(promises);
      log('\n✅ All requests completed! Check OneKey App for toast count.');
    }

    async function triggerMixed5xx() {
      statusEl.innerHTML = '🚀 Triggering mixed 5xx requests...\n';

      const endpoints = [
        '/api/test-500',
        '/api/test-502',
        '/api/test-503',
      ];

      const promises = [];
      for (let i = 1; i <= 15; i++) {
        const endpoint = endpoints[i % 3];
        promises.push(
          fetch(`${BASE_URL}${endpoint}`)
            .then(res => {
              log(`Request ${i} (${endpoint}): ${res.status} ${res.statusText}`);
              return res.text();
            })
            .catch(err => log(`Request ${i}: ❌ ${err.message}`))
        );
      }

      await Promise.all(promises);
      log('\n✅ All requests completed! Check OneKey App for toast count.');
      log('📊 Expected: All 5xx errors should show only 1 toast (toastId = "error_5xx")');
    }
  </script>
</body>
</html>
```

---

## 🧪 How to Run Tests

### Quick Test (Using OneKey Gallery - Recommended)

**This is the easiest way to test!**

1. **Start the test server** (in a separate project):
   ```bash
   cd test-5xx-toast
   npm install
   npm start
   ```

2. **In OneKey App**, navigate to:
   ```
   Developer Gallery → ErrorToast → Deduplication Tests (403/429/5xx)
   ```

3. **Click test buttons**:
   - 🔥 Test 10x 503 (Should show 1 toast)
   - 🔥 Test 10x 502 (Should show 1 toast)
   - 🔥 Test 10x 500 (Should show 1 toast)
   - 🔥 Test 10x 429 (Should show 1 toast)
   - 🔥 Test 10x 403 (Should show 1 toast)
   - 🔥 Test Mixed 5xx (15 requests, should show 1 toast)

4. **Verify**: Each test should show only **1 toast**, not 10 or 15!

### Full Test Setup (External Test Project)

### Step 1: Create Test Project

```bash
# Create directory anywhere on your machine
mkdir test-5xx-toast
cd test-5xx-toast

# Copy the 3 files above:
# - package.json
# - server.js
# - test-client.html
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start Test Server

```bash
npm start
```

You should see:

```
🚀 Test server running at http://localhost:3456

📍 Test endpoints:
   - http://localhost:3456/api/test-503 (Cloudflare 503)
   - http://localhost:3456/api/test-502 (Cloudflare 502)
   - http://localhost:3456/api/test-500 (Cloudflare 500)

📱 Open http://localhost:3456/test-client.html in browser to trigger batch requests
```

### Step 4: Run Tests

#### Option A: Browser Test Client (Recommended)

1. Open browser: `http://localhost:3456/test-client.html`
2. Click "🔥 Trigger 10x 503 Errors"
3. Check OneKey App for toast count

#### Option B: Direct OneKey App Test

Modify OneKey App code to point to local server:

```typescript
// Example: modify an API call that triggers toasts
const testUrl = 'http://localhost:3456/api/test-503';

// Trigger 10 concurrent requests
for (let i = 0; i < 10; i++) {
  fetch(testUrl).catch(() => {
    // Will trigger ErrorToastContainer deduplication logic
  });
}
```

#### Option C: Command Line Test

```bash
# Test single request
curl -i http://localhost:3456/api/test-503

# Simulate toast spam (10 concurrent requests)
for i in {1..10}; do curl http://localhost:3456/api/test-503 & done
```

---

## ✅ Verification Checklist

| Test Scenario | Expected Result | Deduplication Works? |
|--------------|-----------------|---------------------|
| **Trigger 10x 503** | Only 1 toast | ✅ `toastId = 'error_5xx'` |
| **Trigger 10x 502** | Only 1 toast | ✅ `toastId = 'error_5xx'` |
| **Mixed 500/502/503** | Only 1 toast | ✅ All 5xx unified |
| **10x 403** | Only 1 toast | ✅ `toastId = 'error_403'` |
| **10x 429** | Only 1 toast | ✅ `toastId = 'error_429'` |
| **10x 400 (no force)** | Multiple toasts | ✅ Respects custom IDs |

---

## 🔍 Implementation Details

### Deduplication Strategy (Hybrid Approach)

**File**: `packages/kit/src/provider/Container/ErrorToastContainer/ErrorToastContainer.tsx`

```typescript
const getDeduplicationId = (
  code?: number,
): { id: string | undefined; forceDeduplicate: boolean } => {
  if (!code) return { id: undefined, forceDeduplicate: false };

  // Force deduplicate for critical errors
  if (code === 403) return { id: 'error_403', forceDeduplicate: true };
  if (code === 429) return { id: 'error_429', forceDeduplicate: true };
  if (code >= 500 && code < 600) {
    return { id: 'error_5xx', forceDeduplicate: true };
  }

  return { id: undefined, forceDeduplicate: false };
};

// Force deduplication for 403/429/5xx, respect custom IDs for others
const toastId = deduplication.forceDeduplicate
  ? deduplication.id
  : p.toastId || deduplication.id || p.requestId || p.title;
```

### Why Hybrid Strategy?

- **403/429/5xx**: Force deduplication to prevent toast spam during infrastructure outages
- **Other errors**: Allow business logic to customize `toastId` for flexibility
- **Solves production incident**: When Cloudflare goes down, all 5xx errors show as 1 toast

---

## 📸 Production Incident Reference

The test server replicates the exact scenario from the screenshot:
- Multiple "Server error" toasts
- Cloudflare 503 HTML response
- Concurrent API failures

**Before Fix**: 10+ toasts displayed
**After Fix**: Only 1 toast displayed

---

## 🎯 Quick Test Commands

```bash
# Install and run
cd test-5xx-toast
npm install
npm start

# In another terminal - test with curl
for i in {1..10}; do curl http://localhost:3456/api/test-503 & done

# Check OneKey App - should see only 1 toast!
```

---

## 📝 Notes

- The test server runs on port `3456` to avoid conflicts
- CORS is enabled for cross-origin testing
- HTML response matches real Cloudflare 503 pages
- All test scenarios are concurrent to simulate real production load
