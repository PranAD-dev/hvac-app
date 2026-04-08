require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Composio } = require("@composio/core");

const app = express();
app.use(cors());
app.use(express.json());

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  toolkitVersions: {
    gmail: "20260108_00",
  },
});

const ENTITY_ID = "hvac-tech-01";
const GMAIL_AUTH_CONFIG_ID = "ac_zH1dRqcRFuI7";

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Check if Gmail is connected
app.get("/gmail/status", async (req, res) => {
  try {
    const accounts = await composio.connectedAccounts.list({
      authConfigIds: [GMAIL_AUTH_CONFIG_ID],
      userIds: [ENTITY_ID],
    });
    const gmail = (accounts.items || []).find(
      (c) => c.status === "ACTIVE"
    );
    res.json({ connected: !!gmail });
  } catch (err) {
    console.error("Status check error:", err.message);
    res.json({ connected: false });
  }
});

// Start Gmail OAuth
app.post("/gmail/connect", async (req, res) => {
  try {
    const connectionRequest = await composio.connectedAccounts.link(
      ENTITY_ID,
      GMAIL_AUTH_CONFIG_ID,
      {
        callbackUrl: `http://10.104.9.16:${process.env.PORT || 3001}/gmail/callback`,
      }
    );
    res.json({ redirectUrl: connectionRequest.redirectUrl });
  } catch (err) {
    console.error("Gmail connect error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// OAuth callback
app.get("/gmail/callback", (req, res) => {
  res.send(`
    <html>
      <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0F172A; color: white;">
        <div style="text-align: center;">
          <h2>Gmail Connected!</h2>
          <p>You can close this window and go back to the app.</p>
        </div>
      </body>
    </html>
  `);
});

// Send email with service report
app.post("/gmail/send", async (req, res) => {
  const { recipient_email, subject, body, is_html } = req.body;

  if (!recipient_email || !subject || !body) {
    return res
      .status(400)
      .json({ error: "Missing recipient_email, subject, or body" });
  }

  try {
    const result = await composio.tools.execute("GMAIL_SEND_EMAIL", {
      userId: ENTITY_ID,
      arguments: {
        recipient_email,
        subject,
        body,
        is_html: is_html || false,
      },
    });

    res.json({
      success: result.successful ?? result.successfull ?? true,
      data: result.data,
    });
  } catch (err) {
    console.error("Send email error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// JOBBER INTEGRATION (GraphQL + OAuth2)
// ============================================================

const JOBBER_API = "https://api.getjobber.com/api/graphql";
const JOBBER_AUTH_URL = "https://api.getjobber.com/api/oauth/authorize";
const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
const JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;

// In-memory token store (replace with DB in production)
let jobberTokens = {
  access_token: null,
  refresh_token: null,
  expires_at: 0,
};

async function jobberFetch(query, variables) {
  // Auto-refresh if expired
  if (Date.now() > jobberTokens.expires_at && jobberTokens.refresh_token) {
    await refreshJobberToken();
  }
  if (!jobberTokens.access_token) {
    throw new Error("Jobber not connected");
  }

  const res = await fetch(JOBBER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jobberTokens.access_token}`,
      "X-JOBBER-GRAPHQL-VERSION": "2023-11-15",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

async function refreshJobberToken() {
  const res = await fetch(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: JOBBER_CLIENT_ID,
      client_secret: JOBBER_CLIENT_SECRET,
      refresh_token: jobberTokens.refresh_token,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    jobberTokens.access_token = data.access_token;
    jobberTokens.refresh_token = data.refresh_token;
    jobberTokens.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
    console.log("Jobber token refreshed");
  }
}

// Check if Jobber is connected
app.get("/jobber/status", (req, res) => {
  res.json({ connected: !!jobberTokens.access_token });
});

// Start Jobber OAuth
app.get("/jobber/connect", (req, res) => {
  const redirectUri = `http://localhost:3001/jobber/callback`;
  const url = `${JOBBER_AUTH_URL}?client_id=${JOBBER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  res.json({ redirectUrl: url });
});

// Jobber OAuth callback
app.get("/jobber/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const redirectUri = `http://localhost:3001/jobber/callback`;
    const tokenRes = await fetch(JOBBER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: JOBBER_CLIENT_ID,
        client_secret: JOBBER_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await tokenRes.json();

    if (data.access_token) {
      jobberTokens.access_token = data.access_token;
      jobberTokens.refresh_token = data.refresh_token;
      jobberTokens.expires_at = Date.now() + (data.expires_in || 3600) * 1000;

      res.send(`
        <html>
          <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0F172A; color: white;">
            <div style="text-align: center;">
              <h2>Jobber Connected!</h2>
              <p>You can close this window and go back to the app.</p>
            </div>
          </body>
        </html>
      `);
    } else {
      console.error("Jobber token error:", data);
      res.status(400).send("Failed to get token: " + JSON.stringify(data));
    }
  } catch (err) {
    console.error("Jobber callback error:", err.message);
    res.status(500).send("OAuth error: " + err.message);
  }
});

// Get jobs from Jobber
app.get("/jobber/jobs", async (req, res) => {
  try {
    const data = await jobberFetch(`
      query {
        jobs(first: 50, sortOrder: { direction: DESC, key: UPDATED_AT }) {
          nodes {
            id
            jobNumber
            title
            instructions
            jobStatus
            startAt
            endAt
            client {
              id
              firstName
              lastName
              companyName
              billingAddress {
                street1
                street2
                city
                province
                postalCode
              }
              phones {
                number
              }
            }
            lineItems {
              nodes {
                name
                description
                quantity
                unitPrice
              }
            }
          }
        }
      }
    `);
    res.json({ jobs: data.jobs.nodes });
  } catch (err) {
    console.error("Jobber jobs error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update job status in Jobber
app.post("/jobber/jobs/:jobId/complete", async (req, res) => {
  try {
    const data = await jobberFetch(
      `mutation JobComplete($jobId: EncodedId!) {
        jobUpdate(input: { jobId: $jobId, jobStatus: COMPLETED }) {
          job {
            id
            jobNumber
            jobStatus
          }
          userErrors {
            message
            path
          }
        }
      }`,
      { jobId: req.params.jobId }
    );
    const result = data.jobUpdate;
    if (result.userErrors && result.userErrors.length > 0) {
      return res.status(400).json({ error: result.userErrors[0].message });
    }
    res.json({ success: true, job: result.job });
  } catch (err) {
    console.error("Jobber complete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add note to a Jobber job
app.post("/jobber/jobs/:jobId/note", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    const data = await jobberFetch(
      `mutation AddNote($jobId: EncodedId!, $message: String!) {
        jobUpdate(input: { jobId: $jobId, instructions: $message }) {
          job {
            id
            instructions
          }
          userErrors {
            message
            path
          }
        }
      }`,
      { jobId: req.params.jobId, message }
    );
    const result = data.jobUpdate;
    if (result.userErrors && result.userErrors.length > 0) {
      return res.status(400).json({ error: result.userErrors[0].message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Jobber note error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get single job details
app.get("/jobber/jobs/:jobId", async (req, res) => {
  try {
    const data = await jobberFetch(
      `query GetJob($jobId: EncodedId!) {
        job(id: $jobId) {
          id
          jobNumber
          title
          instructions
          jobStatus
          startAt
          endAt
          client {
            id
            firstName
            lastName
            companyName
            billingAddress {
              street1
              street2
              city
              province
              postalCode
            }
            phones {
              number
            }
            emails {
              address
            }
          }
          lineItems {
            nodes {
              name
              description
              quantity
              unitPrice
            }
          }
        }
      }`,
      { jobId: req.params.jobId }
    );
    res.json({ job: data.job });
  } catch (err) {
    console.error("Jobber job detail error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
