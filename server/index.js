/**
 * Combined HVAC Companion server.
 *
 * Merges RAG (Gemini AI), QuickBooks, Gmail (Composio), and Jobber
 * into a single Express server on one port.
 *
 * Usage: node server/index.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const https = require("https");
const querystring = require("querystring");
const os = require("os");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(
  "/clips",
  express.static(path.join(__dirname, "..", "assets", "clips"), {
    setHeaders: (res) => res.setHeader("Accept-Ranges", "bytes"),
  })
);

const PORT = process.env.PORT || 3001;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

// ============================================================
//  HEALTH
// ============================================================

app.get("/health", (req, res) => {
  res.json({ status: "ok", services: ["rag", "quickbooks", "gmail", "jobber"] });
});

// ============================================================
//  RAG — Gemini AI knowledge base
// ============================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing from server/.env");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

let knowledgeBase = "";
let jobCount = 0;

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function jobToDocument(job) {
  const lines = [];
  lines.push(`=== JOB: ${job.customer_name} — ${job.customer_address} ===`);
  lines.push(`Job ID: ${job.id}`);
  lines.push(`Date: ${job.created_at}`);
  lines.push(`Status: ${job.status}`);
  lines.push(`Duration: ${job.duration_minutes} minutes`);
  lines.push(`Technician: ${job.technician_name}`);

  const u = job.unit;
  lines.push(`\nUnit: ${u.brand} ${u.model_number}`);
  lines.push(`Serial: ${u.serial_number}`);
  lines.push(`System: ${u.system_type}, ${u.tonnage}T, ${u.refrigerant_type}, ${u.age_years} years old`);

  const r = job.readings;
  if (r && r.taken_at) {
    lines.push(`\nReadings (taken ${r.taken_at}):`);
    lines.push(`  High side: ${r.high_side_psi} PSI, Low side: ${r.low_side_psi} PSI`);
    lines.push(`  Superheat: ${r.superheat_f}°F, Subcooling: ${r.subcooling_f}°F`);
    lines.push(`  Delta T: ${r.delta_t_f}°F, Outdoor: ${r.outdoor_temp_f}°F`);
    lines.push(`  Voltage: ${r.voltage}V, Amperage: ${r.amperage}A`);
    if (r.static_pressure_in_wc > 0)
      lines.push(`  Static pressure: ${r.static_pressure_in_wc} in.wc`);
  }

  if (job.findings && job.findings.length > 0) {
    lines.push(`\nFindings:`);
    job.findings.forEach((f) => {
      lines.push(`  - [${f.severity}] ${f.component}: ${f.description}`);
    });
  }

  const d = job.diagnosis;
  if (d) {
    lines.push(`\nDiagnosis: ${d.primary_issue} (${d.confidence} confidence)`);
    lines.push(`Urgency: ${d.urgency}`);
    lines.push(`Summary: ${d.technical_summary}`);
    if (d.recommended_actions.length > 0) {
      lines.push(`Recommended actions:`);
      d.recommended_actions.forEach((a, i) => lines.push(`  ${i + 1}. ${a}`));
    }
    if (d.parts_needed.length > 0) {
      lines.push(`Parts needed:`);
      d.parts_needed.forEach((p) => lines.push(`  - ${p.name} (${p.spec}): ${p.reason}`));
    }
  }

  if (job.actions && job.actions.length > 0) {
    lines.push(`\nActions taken:`);
    job.actions.forEach((a) => {
      let detail = a.description;
      if (a.quantity > 0) detail += ` (${a.quantity} ${a.unit})`;
      if (a.part_number) detail += ` Part#: ${a.part_number}`;
      lines.push(`  - ${detail}`);
    });
  }

  if (job.notes && job.notes.length > 0) {
    lines.push(`\nNotes:`);
    job.notes.forEach((n) => {
      lines.push(`  - [${n.source}] ${n.text} (by ${n.created_by}, ${n.created_at})`);
    });
  }

  if (job.story) {
    lines.push(`\nJob Story Summary: ${job.story.summary}`);
    job.story.segments.forEach((s) => {
      lines.push(`  [${formatTimestamp(s.timestamp_start)}-${formatTimestamp(s.timestamp_end)}] ${s.title}: ${s.description}`);
    });
  }

  if (job.service_report) {
    lines.push(`\nService Report:\n${job.service_report}`);
  }

  return lines.join("\n");
}

app.get("/status", (req, res) => {
  res.json({ loaded: jobCount > 0, jobCount });
});

app.post("/index", (req, res) => {
  const jobs = req.body.jobs || [];
  const docs = jobs.map(jobToDocument);
  knowledgeBase = docs.join("\n\n" + "─".repeat(60) + "\n\n");
  jobCount = jobs.length;
  console.log(`[RAG] Knowledge base built: ${jobCount} jobs, ${knowledgeBase.length} chars`);
  res.json({ ok: true, jobCount });
});

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    const hasJobs = knowledgeBase.length > 0;

    const prompt = `You are a senior HVAC technician and expert with 20+ years of field experience. You know everything about residential and commercial HVAC systems — refrigeration cycles, electrical diagnostics, airflow, controls, heat pumps, mini splits, package units, VRF systems, boilers, furnaces, and every tool in the trade.

You are talking to a fellow HVAC tech. They might ask you:
1. Questions about their past jobs (use the job history below if available)
2. General HVAC technical questions — troubleshooting, tool comparisons, system differences, best practices, code requirements, refrigerant handling, etc.
3. Hypothetical scenarios — "what would happen if..." or "how would you handle..."

RULES:
- Speak in second person ("you", "your") — you're talking directly to the tech
- Write like you're talking to a coworker on the job — natural, direct, no fluff
- NO markdown formatting at all. No **, no ##, no bullet points with *, no bold, no headers, no numbered lists
- Use plain text only. Line breaks to separate thoughts
- Be specific — mention actual specs, PSI ranges, temp targets, wire gauges, capacitor ratings, refrigerant properties when relevant
- Compare tools and equipment with real-world pros/cons when asked
- If they ask about a past job, reference their actual data. If they ask general HVAC stuff, use your expertise
- Keep responses conversational but thorough. Match the depth to the question — simple question gets a quick answer, complex scenario gets a detailed walkthrough

${hasJobs ? `=== YOUR JOB HISTORY ===\n\n${knowledgeBase}\n\n=== END JOB HISTORY ===` : "(No job history synced yet)"}

Tech's question: ${question}`;

    const result = await geminiModel.generateContent(prompt);
    res.json({ answer: result.response.text() });
  } catch (err) {
    console.error("[RAG] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/voice/transcribe", async (req, res) => {
  const { audio_base64, mime_type } = req.body;
  if (!audio_base64) return res.status(400).json({ error: "Missing audio_base64" });
  try {
    const result = await geminiModel.generateContent([
      {
        inlineData: {
          data: audio_base64,
          mimeType: mime_type || "audio/m4a",
        },
      },
      {
        text: "Transcribe this audio recording from an HVAC technician. Return only the transcribed text, no commentary, no quotes, no labels. Clean up filler words but preserve technical terms exactly as spoken.",
      },
    ]);
    const text = result.response.text().trim();
    res.json({ transcript: text });
  } catch (err) {
    console.error("[Voice] Transcribe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  QUICKBOOKS — OAuth + Invoice
// ============================================================

const QB_CLIENT_ID = process.env.QB_CLIENT_ID || "ABseVcUMwzd2AabGUQ0Hx1C8Ne177kJr1hlGjPqOvZajiTyyhN";
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET || "cYgNv3NelTGWWDBMHzwtV7bPKtIAUcshthk5Oe4L";
const QB_REDIRECT_URI = `http://localhost:${PORT}/callback`;
const QB_BASE_URL = "https://sandbox-quickbooks.api.intuit.com";
const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

let qbTokens = {
  access_token: null,
  refresh_token: null,
  realm_id: null,
  expires_at: 0,
};

function qbConnected() {
  return qbTokens.access_token && qbTokens.realm_id;
}

function httpsJson(reqUrl, options, body) {
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

async function refreshQBToken() {
  if (!qbTokens.refresh_token) return false;
  if (Date.now() < qbTokens.expires_at - 60000) return true;

  const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
  const body = querystring.stringify({
    grant_type: "refresh_token",
    refresh_token: qbTokens.refresh_token,
  });
  const result = await httpsJson(QB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth}` },
  }, body);

  if (result.data.access_token) {
    qbTokens.access_token = result.data.access_token;
    qbTokens.refresh_token = result.data.refresh_token;
    qbTokens.expires_at = Date.now() + result.data.expires_in * 1000;
    return true;
  }
  return false;
}

async function qbApi(method, endpoint, body) {
  await refreshQBToken();
  const apiUrl = `${QB_BASE_URL}/v3/company/${qbTokens.realm_id}/${endpoint}?minorversion=75`;
  return httpsJson(apiUrl, {
    method,
    headers: {
      Authorization: `Bearer ${qbTokens.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  }, body ? JSON.stringify(body) : null);
}

async function findOrCreateCustomer(name, phone, address) {
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${name.replace(/'/g, "\\'")}'`);
  const searchResult = await qbApi("GET", `query?query=${query}`);
  if (searchResult.data?.QueryResponse?.Customer?.length > 0) {
    return searchResult.data.QueryResponse.Customer[0];
  }
  const result = await qbApi("POST", "customer", {
    DisplayName: name,
    PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    BillAddr: address ? { Line1: address } : undefined,
  });
  if (result.data?.Customer) return result.data.Customer;
  throw new Error(`Failed to create customer: ${JSON.stringify(result.data)}`);
}

async function findOrCreateServiceItem(name, description) {
  const query = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${name.replace(/'/g, "\\'")}'`);
  const searchResult = await qbApi("GET", `query?query=${query}`);
  if (searchResult.data?.QueryResponse?.Item?.length > 0) {
    return searchResult.data.QueryResponse.Item[0];
  }
  const acctQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1");
  const acctResult = await qbApi("GET", `query?query=${acctQuery}`);
  const incomeAcctId = acctResult.data?.QueryResponse?.Account?.[0]?.Id || "1";
  const result = await qbApi("POST", "item", {
    Name: name, Description: description, Type: "Service",
    IncomeAccountRef: { value: incomeAcctId },
  });
  if (result.data?.Item) return result.data.Item;
  throw new Error(`Failed to create item: ${JSON.stringify(result.data)}`);
}

async function createInvoiceFromJob(job) {
  const customer = await findOrCreateCustomer(job.customer_name, job.customer_phone, job.customer_address);
  const lines = [];

  const laborItem = await findOrCreateServiceItem("HVAC Labor", "HVAC service labor");
  if (job.duration_minutes > 0) {
    const hours = Math.round((job.duration_minutes / 60) * 100) / 100;
    lines.push({
      Amount: hours * 100, DetailType: "SalesItemLineDetail",
      Description: `HVAC Service Call — ${job.duration_minutes} min (${hours} hrs)`,
      SalesItemLineDetail: { ItemRef: { value: laborItem.Id, name: laborItem.Name }, Qty: hours, UnitPrice: 100 },
    });
  }

  for (const action of job.actions || []) {
    if (action.type === "refrigerant_added" && action.quantity > 0) {
      const refItem = await findOrCreateServiceItem(`Refrigerant ${job.unit?.refrigerant_type || "R-410A"}`, "Refrigerant charge");
      lines.push({
        Amount: action.quantity * 37.5, DetailType: "SalesItemLineDetail", Description: action.description,
        SalesItemLineDetail: { ItemRef: { value: refItem.Id, name: refItem.Name }, Qty: action.quantity, UnitPrice: 37.5 },
      });
    } else if (action.type === "part_replaced") {
      const partItem = await findOrCreateServiceItem("HVAC Parts", "Replacement parts");
      lines.push({
        Amount: 125, DetailType: "SalesItemLineDetail",
        Description: action.description + (action.part_number ? ` (Part# ${action.part_number})` : ""),
        SalesItemLineDetail: { ItemRef: { value: partItem.Id, name: partItem.Name }, Qty: action.quantity || 1, UnitPrice: 125 },
      });
    }
  }

  if (lines.length === 0) {
    const diagItem = await findOrCreateServiceItem("HVAC Diagnostic", "Diagnostic service fee");
    lines.push({
      Amount: 89, DetailType: "SalesItemLineDetail", Description: "HVAC Diagnostic / Service Call Fee",
      SalesItemLineDetail: { ItemRef: { value: diagItem.Id, name: diagItem.Name }, Qty: 1, UnitPrice: 89 },
    });
  }

  const result = await qbApi("POST", "invoice", {
    Line: lines,
    CustomerRef: { value: customer.Id },
    TxnDate: job.created_at ? job.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    DueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    CustomerMemo: { value: `Service at ${job.customer_address}\nTechnician: ${job.technician_name}\nUnit: ${job.unit?.brand || ""} ${job.unit?.model_number || ""}` },
    PrivateNote: `Job ID: ${job.id}`,
  });

  if (result.data?.Invoice) {
    const inv = result.data.Invoice;
    return { id: inv.Id, docNumber: inv.DocNumber, totalAmount: inv.TotalAmt, lineCount: inv.Line?.length || 0, customerName: customer.DisplayName };
  }
  throw new Error(`Failed to create invoice: ${JSON.stringify(result.data)}`);
}

// QB routes
app.get("/qb/status", (req, res) => {
  res.json({ connected: qbConnected(), realmId: qbTokens.realm_id, configured: QB_CLIENT_ID !== "YOUR_CLIENT_ID" });
});

app.get("/qb/connect", (req, res) => {
  const authUrl = QB_AUTH_URL + "?" + querystring.stringify({
    client_id: QB_CLIENT_ID, response_type: "code",
    scope: "com.intuit.quickbooks.accounting", redirect_uri: QB_REDIRECT_URI, state: "hvac-app",
  });
  const accept = req.headers.accept || "";
  if (accept.includes("text/html") || !accept.includes("application/json")) {
    res.redirect(authUrl);
  } else {
    res.json({ authUrl });
  }
});

app.get("/callback", async (req, res) => {
  const { code, realmId } = req.query;
  if (!code) return res.status(400).send("<h2>Error: No authorization code</h2>");

  try {
    const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
    const body = querystring.stringify({ grant_type: "authorization_code", code, redirect_uri: QB_REDIRECT_URI });
    const result = await httpsJson(QB_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth}` },
    }, body);

    if (result.data.access_token) {
      qbTokens = { access_token: result.data.access_token, refresh_token: result.data.refresh_token, realm_id: realmId, expires_at: Date.now() + result.data.expires_in * 1000 };
      console.log(`[QB] Connected! Realm ID: ${realmId}`);
      res.send(`<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0F172A;color:white;"><div style="text-align:center;"><div style="font-size:48px;margin-bottom:16px;">✓</div><h2>QuickBooks Connected!</h2><p style="color:#94A3B8;">You can close this window.</p></div></body></html>`);
    } else {
      res.status(500).send("<h2>Failed to connect QuickBooks</h2>");
    }
  } catch (err) {
    res.status(500).send("<h2>Error: " + err.message + "</h2>");
  }
});

app.post("/qb/disconnect", (req, res) => {
  qbTokens = { access_token: null, refresh_token: null, realm_id: null, expires_at: 0 };
  res.json({ ok: true });
});

app.post("/qb/invoice", async (req, res) => {
  if (!qbConnected()) return res.status(401).json({ error: "QuickBooks not connected" });
  try {
    const invoice = await createInvoiceFromJob(req.body.job);
    res.json({ success: true, invoice });
  } catch (err) {
    console.error("[QB] Invoice error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  GMAIL — Composio
// ============================================================

const { Composio } = require("@composio/core");

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  toolkitVersions: { gmail: "20260108_00" },
});

const ENTITY_ID = "hvac-tech-01";
const GMAIL_AUTH_CONFIG_ID = "ac_zH1dRqcRFuI7";

app.get("/gmail/status", async (req, res) => {
  try {
    const accounts = await composio.connectedAccounts.list({ authConfigIds: [GMAIL_AUTH_CONFIG_ID], userIds: [ENTITY_ID] });
    const gmail = (accounts.items || []).find((c) => c.status === "ACTIVE");
    res.json({ connected: !!gmail });
  } catch (err) {
    res.json({ connected: false });
  }
});

app.post("/gmail/connect", async (req, res) => {
  try {
    const connectionRequest = await composio.connectedAccounts.link(ENTITY_ID, GMAIL_AUTH_CONFIG_ID, {
      callbackUrl: `http://${getLocalIP()}:${PORT}/gmail/callback`,
    });
    res.json({ redirectUrl: connectionRequest.redirectUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/gmail/callback", (req, res) => {
  res.send(`<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0F172A;color:white;"><div style="text-align:center;"><h2>Gmail Connected!</h2><p>You can close this window.</p></div></body></html>`);
});

app.post("/gmail/send", async (req, res) => {
  const { recipient_email, subject, body, is_html } = req.body;
  if (!recipient_email || !subject || !body) return res.status(400).json({ error: "Missing recipient_email, subject, or body" });

  try {
    const result = await composio.tools.execute("GMAIL_SEND_EMAIL", {
      userId: ENTITY_ID,
      arguments: { recipient_email, subject, body, is_html: is_html || false },
    });
    res.json({ success: result.successful ?? result.successfull ?? true, data: result.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/gmail/send-pdf", async (req, res) => {
  const { recipient_email, subject, body, pdf_base64, filename } = req.body;
  if (!recipient_email || !subject || !body || !pdf_base64) {
    return res.status(400).json({ error: "Missing recipient_email, subject, body, or pdf_base64" });
  }

  const fs = require("fs");
  const os = require("os");
  const tmpPath = path.join(
    os.tmpdir(),
    `${Date.now()}-${(filename || "report.pdf").replace(/[^a-zA-Z0-9._-]/g, "_")}`
  );

  try {
    fs.writeFileSync(tmpPath, Buffer.from(pdf_base64, "base64"));
    const result = await composio.tools.execute("GMAIL_SEND_EMAIL", {
      userId: ENTITY_ID,
      arguments: {
        recipient_email,
        subject,
        body,
        is_html: false,
        attachment: tmpPath,
      },
    });
    res.json({
      success: result.successful ?? result.successfull ?? true,
      data: result.data,
    });
  } catch (err) {
    console.error("send-pdf error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {}
  }
});

// ============================================================
//  JOBBER — GraphQL + OAuth2
// ============================================================

const JOBBER_API = "https://api.getjobber.com/api/graphql";
const JOBBER_AUTH_URL = "https://api.getjobber.com/api/oauth/authorize";
const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;

let jobberTokens = { access_token: null, refresh_token: null, expires_at: 0 };

async function refreshJobberToken() {
  const res = await fetch(JOBBER_TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", client_id: JOBBER_CLIENT_ID, client_secret: JOBBER_CLIENT_SECRET, refresh_token: jobberTokens.refresh_token }),
  });
  const data = await res.json();
  if (data.access_token) {
    jobberTokens.access_token = data.access_token;
    jobberTokens.refresh_token = data.refresh_token;
    jobberTokens.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
  }
}

async function jobberFetch(query, variables) {
  if (Date.now() > jobberTokens.expires_at && jobberTokens.refresh_token) await refreshJobberToken();
  if (!jobberTokens.access_token) throw new Error("Jobber not connected");

  const res = await fetch(JOBBER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jobberTokens.access_token}`, "X-JOBBER-GRAPHQL-VERSION": "2023-11-15" },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

app.get("/jobber/status", (req, res) => {
  res.json({ connected: !!jobberTokens.access_token });
});

app.get("/jobber/connect", (req, res) => {
  const redirectUri = `http://localhost:${PORT}/jobber/callback`;
  const url = `${JOBBER_AUTH_URL}?client_id=${JOBBER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  res.json({ redirectUrl: url });
});

app.get("/jobber/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing authorization code");
  try {
    const redirectUri = `http://localhost:${PORT}/jobber/callback`;
    const tokenRes = await fetch(JOBBER_TOKEN_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", client_id: JOBBER_CLIENT_ID, client_secret: JOBBER_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    });
    const data = await tokenRes.json();
    if (data.access_token) {
      jobberTokens = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
      res.send(`<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0F172A;color:white;"><div style="text-align:center;"><h2>Jobber Connected!</h2><p>You can close this window.</p></div></body></html>`);
    } else {
      res.status(400).send("Failed to get token");
    }
  } catch (err) {
    res.status(500).send("OAuth error: " + err.message);
  }
});

app.get("/jobber/jobs", async (req, res) => {
  try {
    const data = await jobberFetch(`query { jobs(first: 50, sortOrder: { direction: DESC, key: UPDATED_AT }) { nodes { id jobNumber title instructions jobStatus startAt endAt client { id firstName lastName companyName billingAddress { street1 street2 city province postalCode } phones { number } } lineItems { nodes { name description quantity unitPrice } } } } }`);
    res.json({ jobs: data.jobs.nodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/jobber/jobs/:jobId/complete", async (req, res) => {
  try {
    const data = await jobberFetch(`mutation JobComplete($jobId: EncodedId!) { jobUpdate(input: { jobId: $jobId, jobStatus: COMPLETED }) { job { id jobNumber jobStatus } userErrors { message path } } }`, { jobId: req.params.jobId });
    const result = data.jobUpdate;
    if (result.userErrors?.length > 0) return res.status(400).json({ error: result.userErrors[0].message });
    res.json({ success: true, job: result.job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/jobber/jobs/:jobId/note", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message" });
  try {
    const data = await jobberFetch(`mutation AddNote($jobId: EncodedId!, $message: String!) { jobUpdate(input: { jobId: $jobId, instructions: $message }) { job { id instructions } userErrors { message path } } }`, { jobId: req.params.jobId, message });
    const result = data.jobUpdate;
    if (result.userErrors?.length > 0) return res.status(400).json({ error: result.userErrors[0].message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/jobber/jobs/:jobId", async (req, res) => {
  try {
    const data = await jobberFetch(`query GetJob($jobId: EncodedId!) { job(id: $jobId) { id jobNumber title instructions jobStatus startAt endAt client { id firstName lastName companyName billingAddress { street1 street2 city province postalCode } phones { number } emails { address } } lineItems { nodes { name description quantity unitPrice } } } }`, { jobId: req.params.jobId });
    res.json({ job: data.job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  START
// ============================================================

const ip = getLocalIP();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  HVAC Companion Server running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log(`\n  Services: RAG, QuickBooks, Gmail, Jobber\n`);
});
