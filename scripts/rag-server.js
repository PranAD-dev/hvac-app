/**
 * RAG server for HVAC job knowledge base.
 *
 * Endpoints:
 *   POST /index   — receives jobs array, builds knowledge base
 *   POST /ask     — { question: "..." } → answers using Gemini + job context
 *   GET  /status  — check if knowledge base is loaded
 *
 * Usage: node scripts/rag-server.js [port]
 */

const http = require("http");
const os = require("os");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const PORT = parseInt(process.argv[2] || "9091", 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyD9V_kjdfuN_FWO0Hvnw63IVfJOTgJ3x2s";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- Knowledge Base ---

let knowledgeBase = "";
let jobCount = 0;

function jobToDocument(job) {
  const lines = [];
  lines.push(`=== JOB: ${job.customer_name} — ${job.customer_address} ===`);
  lines.push(`Job ID: ${job.id}`);
  lines.push(`Date: ${job.created_at}`);
  lines.push(`Status: ${job.status}`);
  lines.push(`Duration: ${job.duration_minutes} minutes`);
  lines.push(`Technician: ${job.technician_name}`);

  // Unit
  const u = job.unit;
  lines.push(`\nUnit: ${u.brand} ${u.model_number}`);
  lines.push(`Serial: ${u.serial_number}`);
  lines.push(`System: ${u.system_type}, ${u.tonnage}T, ${u.refrigerant_type}, ${u.age_years} years old`);

  // Readings
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

  // Findings
  if (job.findings && job.findings.length > 0) {
    lines.push(`\nFindings:`);
    job.findings.forEach((f) => {
      lines.push(`  - [${f.severity}] ${f.component}: ${f.description}`);
    });
  }

  // Diagnosis
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

  // Actions taken
  if (job.actions && job.actions.length > 0) {
    lines.push(`\nActions taken:`);
    job.actions.forEach((a) => {
      let detail = a.description;
      if (a.quantity > 0) detail += ` (${a.quantity} ${a.unit})`;
      if (a.part_number) detail += ` Part#: ${a.part_number}`;
      lines.push(`  - ${detail}`);
    });
  }

  // Notes
  if (job.notes && job.notes.length > 0) {
    lines.push(`\nNotes:`);
    job.notes.forEach((n) => {
      lines.push(`  - [${n.source}] ${n.text} (by ${n.created_by}, ${n.created_at})`);
    });
  }

  // Story
  if (job.story) {
    lines.push(`\nJob Story Summary: ${job.story.summary}`);
    job.story.segments.forEach((s) => {
      lines.push(`  [${formatTime(s.timestamp_start)}-${formatTime(s.timestamp_end)}] ${s.title}: ${s.description}`);
    });
  }

  // Service report
  if (job.service_report) {
    lines.push(`\nService Report:\n${job.service_report}`);
  }

  return lines.join("\n");
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildKnowledgeBase(jobs) {
  const docs = jobs.map(jobToDocument);
  knowledgeBase = docs.join("\n\n" + "─".repeat(60) + "\n\n");
  jobCount = jobs.length;
  console.log(`Knowledge base built: ${jobCount} jobs, ${knowledgeBase.length} chars`);
}

// --- Chat ---

async function askQuestion(question) {
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

  const result = await model.generateContent(prompt);
  const answer = result.response.text();

  return { answer };
}

// --- Server ---

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

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

  try {
    if (req.url === "/status" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ loaded: jobCount > 0, jobCount }));
    } else if (req.url === "/index" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      buildKnowledgeBase(body.jobs || []);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, jobCount }));
    } else if (req.url === "/ask" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const result = await askQuestion(body.question);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  } catch (err) {
    console.error("Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

const ip = getLocalIP();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nRAG server running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /index  — send { jobs: [...] } to build knowledge base`);
  console.log(`  POST /ask    — send { question: "..." } to ask a question`);
  console.log(`  GET  /status — check if KB is loaded\n`);
});
