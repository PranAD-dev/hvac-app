/**
 * QuickBooks Online integration server for HVAC Companion.
 *
 * Handles:
 *   - OAuth 2.0 connect/callback flow
 *   - Customer creation
 *   - Invoice generation from job data
 *   - Connection status
 *
 * Usage:
 *   node scripts/quickbooks-server.js
 *
 * Before running, set these env vars (or edit the defaults below):
 *   QB_CLIENT_ID, QB_CLIENT_SECRET
 *
 * Get credentials at: https://developer.intuit.com → Create an App → Keys & credentials
 */

const http = require("http");
const https = require("https");
const url = require("url");
const os = require("os");
const querystring = require("querystring");

const PORT = 9092;

// --- QuickBooks Config ---
// Replace these with your Intuit Developer app credentials
const QB_CLIENT_ID = process.env.QB_CLIENT_ID || "ABseVcUMwzd2AabGUQ0Hx1C8Ne177kJr1hlGjPqOvZajiTyyhN";
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET || "cYgNv3NelTGWWDBMHzwtV7bPKtIAUcshthk5Oe4L";

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

const LOCAL_IP = getLocalIP();
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// Use sandbox for development, switch to production URL when ready
const QB_BASE_URL = "https://sandbox-quickbooks.api.intuit.com";
const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// --- Token Storage (in-memory, persist to file for production) ---
let tokens = {
  access_token: null,
  refresh_token: null,
  realm_id: null,
  expires_at: 0,
};

function isConnected() {
  return tokens.access_token && tokens.realm_id;
}

// --- HTTP helpers ---

function jsonRequest(reqUrl, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(reqUrl);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function refreshTokenIfNeeded() {
  if (!tokens.refresh_token) return false;
  if (Date.now() < tokens.expires_at - 60000) return true; // Still valid

  console.log("Refreshing QuickBooks access token...");
  const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
  const body = querystring.stringify({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
  });

  const result = await jsonRequest(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
  }, body);

  if (result.data.access_token) {
    tokens.access_token = result.data.access_token;
    tokens.refresh_token = result.data.refresh_token;
    tokens.expires_at = Date.now() + result.data.expires_in * 1000;
    console.log("Token refreshed successfully");
    return true;
  }
  console.error("Token refresh failed:", result.data);
  return false;
}

async function qbApi(method, endpoint, body) {
  await refreshTokenIfNeeded();
  const apiUrl = `${QB_BASE_URL}/v3/company/${tokens.realm_id}/${endpoint}?minorversion=75`;
  const headers = {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  return jsonRequest(apiUrl, { method, headers }, body ? JSON.stringify(body) : null);
}

// --- QuickBooks Operations ---

async function findOrCreateCustomer(name, phone, address) {
  // Search for existing customer
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${name.replace(/'/g, "\\'")}'`);
  const searchResult = await qbApi("GET", `query?query=${query}`);

  if (searchResult.data?.QueryResponse?.Customer?.length > 0) {
    const existing = searchResult.data.QueryResponse.Customer[0];
    console.log(`Found existing customer: ${existing.DisplayName} (ID: ${existing.Id})`);
    return existing;
  }

  // Create new customer
  const customer = {
    DisplayName: name,
    PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    BillAddr: address
      ? {
          Line1: address,
        }
      : undefined,
  };

  const result = await qbApi("POST", "customer", customer);
  if (result.data?.Customer) {
    console.log(`Created customer: ${result.data.Customer.DisplayName} (ID: ${result.data.Customer.Id})`);
    return result.data.Customer;
  }
  throw new Error(`Failed to create customer: ${JSON.stringify(result.data)}`);
}

async function findOrCreateServiceItem(name, description) {
  const query = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${name.replace(/'/g, "\\'")}'`);
  const searchResult = await qbApi("GET", `query?query=${query}`);

  if (searchResult.data?.QueryResponse?.Item?.length > 0) {
    return searchResult.data.QueryResponse.Item[0];
  }

  // Get income account for the item
  const acctQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1");
  const acctResult = await qbApi("GET", `query?query=${acctQuery}`);
  const incomeAcctId = acctResult.data?.QueryResponse?.Account?.[0]?.Id || "1";

  const item = {
    Name: name,
    Description: description,
    Type: "Service",
    IncomeAccountRef: { value: incomeAcctId },
  };

  const result = await qbApi("POST", "item", item);
  if (result.data?.Item) return result.data.Item;
  throw new Error(`Failed to create item: ${JSON.stringify(result.data)}`);
}

async function createInvoiceFromJob(job) {
  // 1. Find or create customer
  const customer = await findOrCreateCustomer(
    job.customer_name,
    job.customer_phone,
    job.customer_address
  );

  // 2. Build line items from job actions
  const lines = [];

  // Add labor line
  const laborItem = await findOrCreateServiceItem("HVAC Labor", "HVAC service labor");
  if (job.duration_minutes > 0) {
    const hours = Math.round((job.duration_minutes / 60) * 100) / 100;
    lines.push({
      Amount: hours * 100, // $100/hr default
      DetailType: "SalesItemLineDetail",
      Description: `HVAC Service Call — ${job.duration_minutes} min (${hours} hrs)`,
      SalesItemLineDetail: {
        ItemRef: { value: laborItem.Id, name: laborItem.Name },
        Qty: hours,
        UnitPrice: 100,
      },
    });
  }

  // Add parts/actions as line items
  for (const action of job.actions || []) {
    if (action.type === "refrigerant_added" && action.quantity > 0) {
      const refItem = await findOrCreateServiceItem(
        `Refrigerant ${job.unit?.refrigerant_type || "R-410A"}`,
        "Refrigerant charge"
      );
      lines.push({
        Amount: action.quantity * 37.5,
        DetailType: "SalesItemLineDetail",
        Description: action.description,
        SalesItemLineDetail: {
          ItemRef: { value: refItem.Id, name: refItem.Name },
          Qty: action.quantity,
          UnitPrice: 37.5,
        },
      });
    } else if (action.type === "part_replaced") {
      const partItem = await findOrCreateServiceItem("HVAC Parts", "Replacement parts");
      lines.push({
        Amount: 125,
        DetailType: "SalesItemLineDetail",
        Description: action.description + (action.part_number ? ` (Part# ${action.part_number})` : ""),
        SalesItemLineDetail: {
          ItemRef: { value: partItem.Id, name: partItem.Name },
          Qty: action.quantity || 1,
          UnitPrice: 125,
        },
      });
    }
  }

  // Add diagnostic fee if no other parts/labor
  if (lines.length === 0) {
    const diagItem = await findOrCreateServiceItem("HVAC Diagnostic", "Diagnostic service fee");
    lines.push({
      Amount: 89,
      DetailType: "SalesItemLineDetail",
      Description: "HVAC Diagnostic / Service Call Fee",
      SalesItemLineDetail: {
        ItemRef: { value: diagItem.Id, name: diagItem.Name },
        Qty: 1,
        UnitPrice: 89,
      },
    });
  }

  // 3. Create invoice
  const invoice = {
    Line: lines,
    CustomerRef: { value: customer.Id },
    TxnDate: job.created_at ? job.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    CustomerMemo: {
      value: `Service at ${job.customer_address}\nTechnician: ${job.technician_name}\nUnit: ${job.unit?.brand || ""} ${job.unit?.model_number || ""}`,
    },
    PrivateNote: `Job ID: ${job.id}`,
  };

  const result = await qbApi("POST", "invoice", invoice);
  if (result.data?.Invoice) {
    const inv = result.data.Invoice;
    console.log(`Invoice created: #${inv.DocNumber} for $${inv.TotalAmt} (ID: ${inv.Id})`);
    return {
      id: inv.Id,
      docNumber: inv.DocNumber,
      totalAmount: inv.TotalAmt,
      lineCount: inv.Line?.length || 0,
      customerName: customer.DisplayName,
    };
  }
  throw new Error(`Failed to create invoice: ${JSON.stringify(result.data)}`);
}

// --- Server ---

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);

  try {
    // --- Status ---
    if (parsed.pathname === "/qb/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          connected: isConnected(),
          realmId: tokens.realm_id,
          configured: QB_CLIENT_ID !== "YOUR_CLIENT_ID",
        })
      );
    }

    // --- Start OAuth ---
    else if (parsed.pathname === "/qb/connect") {
      const authUrl =
        QB_AUTH_URL +
        "?" +
        querystring.stringify({
          client_id: QB_CLIENT_ID,
          response_type: "code",
          scope: "com.intuit.quickbooks.accounting",
          redirect_uri: REDIRECT_URI,
          state: "hvac-app",
        });

      // If request is from a browser (no JSON accept header), redirect directly
      const accept = req.headers.accept || "";
      if (accept.includes("text/html") || !accept.includes("application/json")) {
        res.writeHead(302, { Location: authUrl });
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ authUrl }));
      }
    }

    // --- OAuth Callback ---
    else if (parsed.pathname === "/callback") {
      const code = parsed.query.code;
      const realmId = parsed.query.realmId;

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>Error: No authorization code received</h2>");
        return;
      }

      // Exchange code for tokens
      const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
      const body = querystring.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      });

      const result = await jsonRequest(QB_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
      }, body);

      if (result.data.access_token) {
        tokens = {
          access_token: result.data.access_token,
          refresh_token: result.data.refresh_token,
          realm_id: realmId,
          expires_at: Date.now() + result.data.expires_in * 1000,
        };

        console.log(`QuickBooks connected! Realm ID: ${realmId}`);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0F172A; color: white;">
              <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
                <h2>QuickBooks Connected!</h2>
                <p style="color: #94A3B8;">You can close this window and return to the app.</p>
              </div>
            </body>
          </html>
        `);
      } else {
        console.error("Token exchange failed:", result.data);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("<h2>Failed to connect QuickBooks</h2><pre>" + JSON.stringify(result.data, null, 2) + "</pre>");
      }
    }

    // --- Disconnect ---
    else if (parsed.pathname === "/qb/disconnect" && req.method === "POST") {
      tokens = { access_token: null, refresh_token: null, realm_id: null, expires_at: 0 };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    }

    // --- Create Invoice ---
    else if (parsed.pathname === "/qb/invoice" && req.method === "POST") {
      if (!isConnected()) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "QuickBooks not connected" }));
        return;
      }

      const body = JSON.parse(await readBody(req));
      const invoice = await createInvoiceFromJob(body.job);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, invoice }));
    }

    // --- 404 ---
    else {
      res.writeHead(404);
      res.end("Not found");
    }
  } catch (err) {
    console.error("Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nQuickBooks server running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${LOCAL_IP}:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /qb/status     — check connection`);
  console.log(`  GET  /qb/connect    — start OAuth flow`);
  console.log(`  GET  /callback      — OAuth redirect (automatic)`);
  console.log(`  POST /qb/disconnect — disconnect`);
  console.log(`  POST /qb/invoice    — create invoice from job\n`);

  if (QB_CLIENT_ID === "YOUR_CLIENT_ID") {
    console.log(`⚠  No QuickBooks credentials configured.`);
    console.log(`   Get them at https://developer.intuit.com`);
    console.log(`   Then set QB_CLIENT_ID and QB_CLIENT_SECRET env vars.\n`);
  }
});
