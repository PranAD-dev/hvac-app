import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  PanResponder,
  GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";
import { FontAwesome } from "@expo/vector-icons";
import { Note, Clip, Job } from "../../types";
import * as WebBrowser from "expo-web-browser";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const COMPOSIO_SERVER = "http://10.104.9.16:3001";
const QB_SERVER = "http://10.104.9.16:9092";

// --- PDF Generator ---

function generateReportHTML(job: Job): string {
  const { unit, readings, findings, diagnosis, actions } = job;
  const date = new Date(job.created_at).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const readingRows = readings.taken_at
    ? `
    <tr><td>High Side</td><td>${readings.high_side_psi} PSI</td></tr>
    <tr><td>Low Side</td><td>${readings.low_side_psi} PSI</td></tr>
    <tr><td>Superheat</td><td>${readings.superheat_f}°F</td></tr>
    <tr><td>Subcooling</td><td>${readings.subcooling_f}°F</td></tr>
    <tr><td>Delta T</td><td>${readings.delta_t_f}°F</td></tr>
    <tr><td>Supply Air</td><td>${readings.supply_air_temp_f}°F</td></tr>
    <tr><td>Return Air</td><td>${readings.return_air_temp_f}°F</td></tr>
    <tr><td>Outdoor Temp</td><td>${readings.outdoor_temp_f}°F</td></tr>
    <tr><td>Voltage</td><td>${readings.voltage}V</td></tr>
    <tr><td>Amperage</td><td>${readings.amperage}A</td></tr>
    ${readings.static_pressure_in_wc > 0 ? `<tr><td>Static Pressure</td><td>${readings.static_pressure_in_wc} in.wc</td></tr>` : ""}
  `
    : "";

  const findingsHTML = findings.length
    ? findings
        .map(
          (f) =>
            `<div style="margin-bottom:8px;padding:8px 12px;background:${f.severity === "critical" ? "#FEF2F2" : f.severity === "warning" ? "#FFF7ED" : "#EFF6FF"};border-radius:6px;border-left:3px solid ${f.severity === "critical" ? "#DC2626" : f.severity === "warning" ? "#EA580C" : "#2563EB"}">
              <strong style="text-transform:capitalize">${f.component.replace(/_/g, " ")}</strong> <span style="color:#64748B;font-size:11px">(${f.severity})</span>
              <div style="color:#475569;font-size:13px;margin-top:4px">${f.description}</div>
            </div>`
        )
        .join("")
    : "<p style='color:#94A3B8'>No findings</p>";

  const actionsHTML = actions.length
    ? actions
        .map(
          (a) =>
            `<div style="margin-bottom:6px;padding:8px 12px;background:#F0FDF4;border-radius:6px;border-left:3px solid #16A34A">
              <span style="color:#15803D;font-size:13px">${a.description}</span>
              ${a.quantity > 0 ? `<span style="color:#94A3B8;font-size:11px;margin-left:8px">Qty: ${a.quantity} ${a.unit}${a.part_number ? ` #${a.part_number}` : ""}</span>` : ""}
            </div>`
        )
        .join("")
    : "<p style='color:#94A3B8'>No actions taken</p>";

  const partsHTML = diagnosis.parts_needed.length
    ? diagnosis.parts_needed
        .map(
          (p) =>
            `<tr><td>${p.name}</td><td style="font-family:monospace">${p.spec}</td><td style="color:#64748B">${p.reason}</td></tr>`
        )
        .join("")
    : "";

  const notesHTML = (job.notes || []).length
    ? (job.notes || [])
        .map(
          (n) =>
            `<div style="margin-bottom:6px;padding:8px 12px;background:${n.source === "vision" ? "#F5F3FF" : "#EFF6FF"};border-radius:6px;border-left:3px solid ${n.source === "vision" ? "#7C3AED" : "#2563EB"}">
              <span style="font-size:10px;font-weight:700;color:${n.source === "vision" ? "#7C3AED" : "#2563EB"};text-transform:uppercase">${n.source}</span>
              <div style="color:#475569;font-size:13px;margin-top:3px">${n.text}</div>
            </div>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0F172A; font-size: 14px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; margin: 28px 0 12px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px; }
  .header { background: #0F172A; color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
  .header h1 { color: white; font-size: 22px; }
  .header p { color: #94A3B8; margin: 4px 0 0; font-size: 13px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .meta { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
  .meta-item { color: #CBD5E1; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
  table td:first-child { color: #64748B; width: 40%; }
  table td:last-child { font-weight: 600; }
  .unit-card { background: #F8FAFC; padding: 16px; border-radius: 10px; }
  .unit-name { font-size: 18px; font-weight: 800; }
  .unit-model { font-family: monospace; color: #64748B; font-size: 13px; margin-top: 2px; }
  .tags { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .tag { background: #E2E8F0; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #475569; }
  .diagnosis-box { background: #F8FAFC; padding: 16px; border-radius: 10px; }
  .diagnosis-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .diagnosis-summary { color: #475569; line-height: 1.6; font-size: 13px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #E2E8F0; color: #94A3B8; font-size: 11px; text-align: center; }
</style></head>
<body>

<div class="header">
  <h1>Service Report</h1>
  <p>${job.customer_name} — ${job.customer_address}</p>
  <div class="meta">
    <span class="meta-item">${date}</span>
    <span class="meta-item">Tech: ${job.technician_name}</span>
    ${job.duration_minutes > 0 ? `<span class="meta-item">${job.duration_minutes} min</span>` : ""}
    <span class="badge" style="background:${diagnosis.urgency === "emergency" ? "#DC2626" : diagnosis.urgency === "urgent" ? "#EA580C" : "#16A34A"};color:white">${diagnosis.urgency}</span>
  </div>
</div>

<h2>Unit Information</h2>
<div class="unit-card">
  <div class="unit-name">${unit.brand}</div>
  <div class="unit-model">${unit.model_number}</div>
  <div class="tags">
    <span class="tag">${unit.refrigerant_type}</span>
    <span class="tag">${unit.tonnage}T</span>
    <span class="tag">${unit.system_type}</span>
    <span class="tag">${unit.age_years} yr old</span>
    <span class="tag">S/N: ${unit.serial_number}</span>
  </div>
</div>

${readings.taken_at ? `<h2>Readings</h2><table>${readingRows}</table>` : ""}

<h2>AI Findings</h2>
${findingsHTML}

<h2>AI Diagnosis</h2>
<div class="diagnosis-box">
  <div class="diagnosis-title">${diagnosis.primary_issue}</div>
  <div style="margin-bottom:8px"><span class="badge" style="background:${diagnosis.confidence === "high" ? "#DCFCE7" : diagnosis.confidence === "medium" ? "#FEF9C3" : "#FEF2F2"};color:${diagnosis.confidence === "high" ? "#16A34A" : diagnosis.confidence === "medium" ? "#CA8A04" : "#EA580C"}">${diagnosis.confidence} confidence</span></div>
  <div class="diagnosis-summary">${diagnosis.technical_summary}</div>
  ${diagnosis.recommended_actions.length ? `<div style="margin-top:12px"><strong style="font-size:12px;color:#64748B;text-transform:uppercase">Recommended Actions</strong>${diagnosis.recommended_actions.map((a, i) => `<div style="margin-top:6px;font-size:13px;color:#334155">${i + 1}. ${a}</div>`).join("")}</div>` : ""}
</div>

${partsHTML ? `<h2>Parts Needed</h2><table><tr style="background:#FFFBEB"><td><strong>Part</strong></td><td><strong>Spec</strong></td><td><strong>Reason</strong></td></tr>${partsHTML}</table>` : ""}

<h2>Actions Taken</h2>
${actionsHTML}

${notesHTML ? `<h2>Technician Notes</h2>${notesHTML}` : ""}

<h2>Service Report</h2>
<p style="color:#475569;line-height:1.7;font-size:13px">${job.service_report || "Report pending."}</p>

<div class="footer">
  Generated by HVAC Companion — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
</div>

</body></html>`;
}

// --- Helpers ---

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "#DC2626";
    case "warning":
      return "#EA580C";
    default:
      return "#2563EB";
  }
}

function getSeverityIcon(severity: string): React.ComponentProps<typeof FontAwesome>["name"] {
  switch (severity) {
    case "critical":
      return "exclamation-triangle";
    case "warning":
      return "exclamation-circle";
    default:
      return "info-circle";
  }
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case "emergency":
      return "#DC2626";
    case "urgent":
      return "#EA580C";
    default:
      return "#16A34A";
  }
}

type ReadingStatus = "normal" | "warning" | "critical";

function getReadingStatus(
  value: number,
  min: number,
  max: number
): ReadingStatus {
  if (value >= min && value <= max) return "normal";
  const diff = value < min ? min - value : value - max;
  const range = max - min;
  if (diff > range * 0.5) return "critical";
  return "warning";
}

function getStatusColor(status: ReadingStatus) {
  switch (status) {
    case "normal":
      return "#16A34A";
    case "warning":
      return "#EA580C";
    case "critical":
      return "#DC2626";
  }
}

function formatDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getActionIcon(type: string): React.ComponentProps<typeof FontAwesome>["name"] {
  switch (type) {
    case "refrigerant_added":
      return "tint";
    case "part_replaced":
      return "exchange";
    case "repair_made":
      return "wrench";
    case "cleaned":
      return "shower";
    case "adjusted":
      return "sliders";
    case "inspected_only":
      return "eye";
    case "deferred":
      return "clock-o";
    default:
      return "check";
  }
}

// --- Section Components ---

function SectionHeader({ title, icon }: { title: string; icon?: React.ComponentProps<typeof FontAwesome>["name"] }) {
  return (
    <View className="flex-row items-center px-5 mt-7 mb-3">
      {icon && (
        <View className="w-5 h-5 rounded items-center justify-center mr-2">
          <FontAwesome name={icon} size={11} color="#94A3B8" />
        </View>
      )}
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">
        {title}
      </Text>
    </View>
  );
}

function Card({ children, noPadding }: { children: React.ReactNode; noPadding?: boolean }) {
  return (
    <View
      className={`bg-white mx-4 rounded-2xl ${noPadding ? "" : "p-5"}`}
      style={{
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function ReadingCell({
  label,
  value,
  unit,
  status,
  target,
}: {
  label: string;
  value: number;
  unit: string;
  status: ReadingStatus;
  target?: string;
}) {
  const color = getStatusColor(status);
  return (
    <View className="items-center flex-1 py-3">
      <Text className="text-xs font-semibold text-slate-400 mb-1.5 tracking-wide">
        {label}
      </Text>
      <View className="flex-row items-baseline">
        <Text className="text-xl font-bold" style={{ color: status === "normal" ? "#0F172A" : color }}>
          {value}
        </Text>
        <Text className="text-xs font-medium text-slate-400 ml-0.5">{unit}</Text>
      </View>
      {target && (
        <Text className="text-xs text-slate-300 mt-1">{target}</Text>
      )}
      <View
        className="w-1.5 h-1.5 rounded-full mt-2"
        style={{ backgroundColor: color }}
      />
    </View>
  );
}

// --- Main Screen ---

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const { addNote, deleteNote, deleteClip, saveSignature } = useJobStore();
  const techName = useJobStore((s) => s.techName);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMode, setEmailMode] = useState<"simple" | "pdf">("simple");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signPaths, setSignPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [signerName, setSignerName] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState<{ docNumber: string; totalAmount: number } | null>(null);

  const signPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath((prev) => prev + ` L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        setSignPaths((prev) => [...prev, currentPath]);
        setCurrentPath("");
      },
    })
  ).current;

  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-slate-400">Job not found</Text>
      </View>
    );
  }

  const { unit, readings, findings, diagnosis, actions, photos } = job;
  const notes = job.notes || [];
  const clips = job.clips || [];

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote(job.id, noteText, "manual", techName);
    setNoteText("");
    setShowNoteModal(false);
  };

  const handleDeleteNote = (note: Note) => {
    Alert.alert("Delete Note", "Remove this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteNote(job.id, note.id),
      },
    ]);
  };

  const handleDeleteClip = (clip: Clip) => {
    Alert.alert("Delete Clip", "Remove this clip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteClip(job.id, clip.id),
      },
    ]);
  };

  const handleConnectGmail = async () => {
    try {
      const res = await fetch(`${COMPOSIO_SERVER}/gmail/connect`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.redirectUrl) {
        await WebBrowser.openBrowserAsync(data.redirectUrl);
      } else {
        Alert.alert("Error", data.error || "Failed to start Gmail auth");
      }
    } catch {
      Alert.alert(
        "Server Not Running",
        "Start the Composio server first:\ncd server && node index.js"
      );
    }
  };

  const handleEmailReport = async () => {
    if (!emailTo.trim()) {
      Alert.alert("Missing Email", "Enter a recipient email address.");
      return;
    }
    setEmailSending(true);
    try {
      const statusRes = await fetch(`${COMPOSIO_SERVER}/gmail/status`);
      const status = await statusRes.json();
      if (!status.connected) {
        setEmailSending(false);
        Alert.alert(
          "Gmail Not Connected",
          "Connect your Gmail account first.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Connect Gmail", onPress: handleConnectGmail },
          ]
        );
        return;
      }

      let emailSubject: string;
      let emailBody: string;

      if (emailMode === "pdf") {
        // Generate detailed HTML report and send as HTML email
        emailSubject = `HVAC Detailed Service Report — ${job.customer_name} — ${formatDateTime(job.created_at)}`;
        emailBody = generateReportHTML(job);

        const res = await fetch(`${COMPOSIO_SERVER}/gmail/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_email: emailTo.trim(),
            subject: emailSubject,
            body: emailBody,
            is_html: true,
          }),
        });
        const result = await res.json();
        setEmailSending(false);

        if (result.success) {
          setShowEmailModal(false);
          setEmailTo("");
          Alert.alert("Sent!", `Detailed report emailed to ${emailTo.trim()}`);
        } else {
          Alert.alert("Failed", result.error || "Could not send report.");
        }
      } else {
        // Simple text email
        emailSubject = `HVAC Service Report — ${job.customer_name} — ${formatDateTime(job.created_at)}`;
        emailBody = `Service Report\n${job.customer_name} — ${job.customer_address}\n${formatDateTime(job.created_at)}\nTechnician: ${job.technician_name}\n\n${job.service_report}`;

        const res = await fetch(`${COMPOSIO_SERVER}/gmail/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_email: emailTo.trim(),
            subject: emailSubject,
            body: emailBody,
          }),
        });
        const result = await res.json();
        setEmailSending(false);

        if (result.success) {
          setShowEmailModal(false);
          setEmailTo("");
          Alert.alert("Sent!", `Report emailed to ${emailTo.trim()}`);
        } else {
          Alert.alert("Failed", result.error || "Could not send email.");
        }
      }
    } catch {
      setEmailSending(false);
      Alert.alert(
        "Server Not Running",
        "Start the Composio server first:\ncd server && node index.js"
      );
    }
  };

  const handleCreateInvoice = async () => {
    setInvoiceLoading(true);
    try {
      const statusRes = await fetch(`${QB_SERVER}/qb/status`);
      const status = await statusRes.json();
      if (!status.connected) {
        setInvoiceLoading(false);
        Alert.alert(
          "QuickBooks Not Connected",
          "Connect QuickBooks in Settings first."
        );
        return;
      }

      const res = await fetch(`${QB_SERVER}/qb/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const result = await res.json();
      setInvoiceLoading(false);

      if (result.success) {
        setInvoiceCreated({
          docNumber: result.invoice.docNumber,
          totalAmount: result.invoice.totalAmount,
        });
        Alert.alert(
          "Invoice Created",
          `Invoice #${result.invoice.docNumber} for $${result.invoice.totalAmount} sent to QuickBooks.`
        );
      } else {
        Alert.alert("Failed", result.error || "Could not create invoice.");
      }
    } catch {
      setInvoiceLoading(false);
      Alert.alert(
        "Server Not Running",
        "Start the QuickBooks server:\nnode scripts/quickbooks-server.js"
      );
    }
  };

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const handleShareReport = async () => {
    if (!job.service_report) {
      Alert.alert("No Report", "This job doesn't have a service report yet.");
      return;
    }
    try {
      await Share.share({
        message: `Service Report\n${job.customer_name} — ${job.customer_address}\n${formatDateTime(job.created_at)}\nTechnician: ${job.technician_name}\n\n${job.service_report}`,
      });
    } catch {}
  };

  const urgencyColor = getUrgencyColor(diagnosis.urgency);

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Job Header */}
      <View className="bg-white px-5 pt-5 pb-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-xl font-bold text-slate-900">
              {job.customer_name}
            </Text>
            <View className="flex-row items-center mt-1">
              <FontAwesome name="map-marker" size={12} color="#94A3B8" />
              <Text className="text-sm text-slate-500 ml-1.5" numberOfLines={1}>
                {job.customer_address}
              </Text>
            </View>
          </View>
          {job.status === "in_progress" ? (
            <View className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
              <Text className="text-xs font-bold text-blue-600">IN PROGRESS</Text>
            </View>
          ) : (
            <View
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: urgencyColor + "14" }}
            >
              <Text
                className="text-xs font-bold uppercase"
                style={{ color: urgencyColor }}
              >
                {diagnosis.urgency}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center mt-3 flex-wrap gap-2">
          {job.source === "jobber" && (
            <View className="flex-row items-center bg-green-50 px-2.5 py-1 rounded-lg">
              <FontAwesome name="calendar-check-o" size={10} color="#16A34A" />
              <Text className="text-xs text-green-600 ml-1.5 font-bold">Jobber</Text>
            </View>
          )}
          <View className="flex-row items-center bg-slate-100 px-2.5 py-1 rounded-lg">
            <FontAwesome name="clock-o" size={10} color="#64748B" />
            <Text className="text-xs text-slate-600 ml-1.5 font-medium">
              {formatDateTime(job.created_at)}
            </Text>
          </View>
          {job.duration_minutes > 0 && (
            <View className="bg-slate-100 px-2.5 py-1 rounded-lg">
              <Text className="text-xs text-slate-600 font-medium">
                {job.duration_minutes} min
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Story Button */}
      {job.story && (
        <Pressable
          onPress={() => router.push(`/story/${job.id}`)}
          className="mx-4 mt-4 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#0F172A",
            shadowColor: "#0F172A",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View className="flex-row items-center px-5 py-4">
            <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center mr-3">
              <FontAwesome name="film" size={16} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-sm">View Job Story</Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                {job.story.segments.length} key moments · AI summary
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#64748B" />
          </View>
        </Pressable>
      )}

      {/* Section A — Readings */}
      {readings.taken_at && (
        <>
          <SectionHeader title="Readings" icon="dashboard" />
          <Card>
            <View className="flex-row border-b border-slate-100 pb-1">
              <ReadingCell
                label="HIGH SIDE"
                value={readings.high_side_psi}
                unit=" PSI"
                status={getReadingStatus(readings.high_side_psi, 200, 420)}
              />
              <ReadingCell
                label="LOW SIDE"
                value={readings.low_side_psi}
                unit=" PSI"
                status={getReadingStatus(readings.low_side_psi, 57, 140)}
              />
            </View>

            <View className="flex-row border-b border-slate-100 py-1">
              <ReadingCell
                label="SUPERHEAT"
                value={readings.superheat_f}
                unit="°F"
                status={getReadingStatus(readings.superheat_f, 10, 15)}
                target="10-15°F"
              />
              <ReadingCell
                label="SUBCOOLING"
                value={readings.subcooling_f}
                unit="°F"
                status={getReadingStatus(readings.subcooling_f, 8, 12)}
                target="8-12°F"
              />
            </View>

            <View className="flex-row border-b border-slate-100 py-1">
              <ReadingCell
                label="DELTA T"
                value={readings.delta_t_f}
                unit="°F"
                status={getReadingStatus(readings.delta_t_f, 16, 22)}
                target="16-22°F"
              />
              <ReadingCell
                label="OUTDOOR"
                value={readings.outdoor_temp_f}
                unit="°F"
                status="normal"
              />
            </View>

            <View className="flex-row pt-1">
              <ReadingCell
                label="VOLTAGE"
                value={readings.voltage}
                unit="V"
                status={getReadingStatus(readings.voltage, 210, 250)}
              />
              <ReadingCell
                label="AMPERAGE"
                value={readings.amperage}
                unit="A"
                status="normal"
              />
            </View>

            {readings.static_pressure_in_wc > 0 && (
              <View className="flex-row pt-1 border-t border-slate-100">
                <ReadingCell
                  label="STATIC PRESSURE"
                  value={readings.static_pressure_in_wc}
                  unit=" in.wc"
                  status={getReadingStatus(readings.static_pressure_in_wc, 0.2, 0.5)}
                  target="0.2-0.5"
                />
                <View className="flex-1" />
              </View>
            )}
          </Card>
        </>
      )}

      {/* Section C — Unit Info */}
      <SectionHeader title="Unit Info" icon="hdd-o" />
      <Pressable onPress={() => router.push(`/unit/${unit.serial_number}`)}>
        <Card>
          <View className="flex-row items-center">
            <View className="w-14 h-14 bg-slate-100 rounded-xl items-center justify-center mr-4">
              <Text className="text-lg font-black text-slate-500">
                {unit.brand.charAt(0)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-900">
                {unit.brand}
              </Text>
              <Text className="text-sm text-slate-500 mt-0.5 font-mono" numberOfLines={1}>
                {unit.model_number}
              </Text>
              <View className="flex-row items-center mt-2 flex-wrap gap-1.5">
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">{unit.refrigerant_type}</Text>
                </View>
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">{unit.tonnage}T</Text>
                </View>
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">{unit.system_type}</Text>
                </View>
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">{unit.age_years}yr</Text>
                </View>
              </View>
            </View>
            <View className="w-7 h-7 bg-slate-100 rounded-full items-center justify-center">
              <FontAwesome name="chevron-right" size={10} color="#94A3B8" />
            </View>
          </View>
        </Card>
      </Pressable>

      {/* Section C — Notes & Clips Side by Side */}
      <SectionHeader title="Notes & Clips" icon="sticky-note-o" />
      <View className="flex-row px-4 gap-3">
        {/* Notes Column */}
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <FontAwesome name="pencil" size={11} color="#64748B" />
            <Text className="text-xs font-bold text-slate-500 ml-1.5 uppercase tracking-wide">
              Notes ({notes.length})
            </Text>
          </View>
          {notes.length > 0 ? (
            notes.slice(0, 3).map((note) => {
              const isVision = note.source === "vision";
              return (
                <Pressable
                  key={note.id}
                  onLongPress={() => handleDeleteNote(note)}
                  className="bg-white rounded-xl p-3 mb-2"
                  style={{
                    shadowColor: "#0F172A",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row items-center mb-1.5">
                    <View
                      className="px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: isVision ? "#7C3AED14" : "#2563EB14",
                      }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: isVision ? "#7C3AED" : "#2563EB" }}
                      >
                        {isVision ? "VISION" : "MANUAL"}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-xs text-slate-700 leading-4"
                    numberOfLines={3}
                  >
                    {note.text}
                  </Text>
                  <Text className="text-xs text-slate-300 mt-1.5">
                    {formatDateTime(note.created_at)}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <View className="bg-white rounded-xl p-4 items-center">
              <FontAwesome name="sticky-note-o" size={18} color="#CBD5E1" />
              <Text className="text-xs text-slate-400 mt-1.5">No notes</Text>
            </View>
          )}
          {notes.length > 3 && (
            <Text className="text-xs text-slate-400 text-center mt-1">
              +{notes.length - 3} more
            </Text>
          )}
          <Pressable
            onPress={() => setShowNoteModal(true)}
            className="mt-2 rounded-xl py-2.5 items-center"
            style={{ backgroundColor: "#0F172A" }}
          >
            <View className="flex-row items-center">
              <FontAwesome name="plus" size={10} color="#fff" />
              <Text className="text-white font-bold text-xs ml-1.5">Add Note</Text>
            </View>
          </Pressable>
        </View>

        {/* Clips Column */}
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <FontAwesome name="video-camera" size={11} color="#64748B" />
            <Text className="text-xs font-bold text-slate-500 ml-1.5 uppercase tracking-wide">
              Clips ({clips.length})
            </Text>
          </View>
          {clips.length > 0 ? (
            clips.slice(0, 3).map((clip) => (
              <Pressable
                key={clip.id}
                onLongPress={() => handleDeleteClip(clip)}
                className="bg-slate-800 rounded-xl mb-2 overflow-hidden"
                style={{
                  shadowColor: "#0F172A",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View className="h-20 items-center justify-center">
                  <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                    <FontAwesome name="play" size={14} color="#fff" />
                  </View>
                  <View className="absolute bottom-2 right-2 bg-black/60 px-1.5 py-0.5 rounded">
                    <Text className="text-xs text-white font-mono">
                      {formatDuration(clip.duration_seconds)}
                    </Text>
                  </View>
                </View>
                <View className="bg-white px-3 py-2">
                  <Text className="text-xs text-slate-700" numberOfLines={1}>
                    {clip.caption || "Untitled clip"}
                  </Text>
                  <Text className="text-xs text-slate-300 mt-0.5">
                    {formatDateTime(clip.recorded_at)}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View className="bg-white rounded-xl p-4 items-center">
              <FontAwesome name="video-camera" size={18} color="#CBD5E1" />
              <Text className="text-xs text-slate-400 mt-1.5">No clips</Text>
              <Text className="text-xs text-slate-300 mt-0.5 text-center">
                Record from glasses
              </Text>
            </View>
          )}
          {clips.length > 3 && (
            <Text className="text-xs text-slate-400 text-center mt-1">
              +{clips.length - 3} more
            </Text>
          )}
        </View>
      </View>

      {/* Section D — AI Findings */}
      {findings.length > 0 && (
        <>
          <SectionHeader title="AI Findings" icon="eye" />
          {findings.map((finding) => (
            <View key={finding.id} className="mb-2">
              <Card>
                <View className="flex-row items-start">
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: getSeverityColor(finding.severity) + "12" }}
                  >
                    <FontAwesome
                      name={getSeverityIcon(finding.severity)}
                      size={16}
                      color={getSeverityColor(finding.severity)}
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-sm font-bold text-slate-900 capitalize">
                        {finding.component.replace(/_/g, " ")}
                      </Text>
                      <View
                        className="ml-2 px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: getSeverityColor(finding.severity) + "14" }}
                      >
                        <Text
                          className="text-xs font-bold capitalize"
                          style={{ color: getSeverityColor(finding.severity) }}
                        >
                          {finding.severity}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm text-slate-500 mt-1.5 leading-5">
                      {finding.description}
                    </Text>
                  </View>
                </View>
              </Card>
            </View>
          ))}
        </>
      )}

      {/* Section E — Actions Taken */}
      {actions.length > 0 && (
        <>
          <SectionHeader title="Actions Taken" icon="check-circle" />
          <Card>
            {actions.map((action, i) => (
              <View
                key={action.id}
                className={`flex-row items-start ${i < actions.length - 1 ? "mb-4 pb-4 border-b border-slate-100" : ""}`}
              >
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center mr-3 mt-0.5"
                  style={{ backgroundColor: "#16A34A14" }}
                >
                  <FontAwesome
                    name={getActionIcon(action.type)}
                    size={13}
                    color="#16A34A"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-900 leading-5">
                    {action.description}
                  </Text>
                  {action.quantity > 0 && (
                    <Text className="text-xs text-slate-400 mt-1">
                      Qty: {action.quantity} {action.unit}
                      {action.part_number ? `  #${action.part_number}` : ""}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Section F — Service Report */}
      {job.service_report ? (
        <>
          <SectionHeader title="Service Report" icon="file-text-o" />
          <Card>
            <Text className="text-sm text-slate-600 leading-6">
              {job.service_report}
            </Text>
          </Card>
          <View className="flex-row mx-4 mt-3 gap-3">
            <Pressable
              onPress={() => {
                setEmailMode("simple");
                setShowEmailModal(true);
              }}
              className="flex-1 rounded-2xl py-4 items-center"
              style={{ backgroundColor: "#0F172A" }}
            >
              <View className="flex-row items-center">
                <FontAwesome name="envelope-o" size={14} color="#fff" />
                <Text className="text-white font-bold text-sm ml-2">
                  Email
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                setEmailMode("pdf");
                setShowEmailModal(true);
              }}
              className="flex-1 rounded-2xl py-4 items-center"
              style={{ backgroundColor: "#2563EB" }}
            >
              <View className="flex-row items-center">
                <FontAwesome name="file-pdf-o" size={14} color="#fff" />
                <Text className="text-white font-bold text-sm ml-2">
                  Detailed Report
                </Text>
              </View>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <SectionHeader title="Service Report" icon="file-text-o" />
          <Card>
            <View className="items-center py-6">
              <FontAwesome name="file-text-o" size={24} color="#CBD5E1" />
              <Text className="text-sm text-slate-400 mt-2">
                Report generated when job completes.
              </Text>
            </View>
          </Card>
        </>
      )}

      {/* QuickBooks Invoice */}
      {job.status === "completed" && (
        <>
          <SectionHeader title="Invoice" icon="file-text" />
          {invoiceCreated ? (
            <Card>
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-xl bg-green-50 items-center justify-center mr-3">
                  <FontAwesome name="check-circle" size={20} color="#16A34A" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">
                    Invoice #{invoiceCreated.docNumber}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-0.5">
                    ${invoiceCreated.totalAmount} · Sent to QuickBooks
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <Pressable
              onPress={handleCreateInvoice}
              disabled={invoiceLoading}
              className="mx-4 rounded-2xl py-4 items-center"
              style={{ backgroundColor: invoiceLoading ? "#86EFAC" : "#16A34A" }}
            >
              {invoiceLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <FontAwesome name="book" size={14} color="#fff" />
                  <Text className="text-white font-bold text-sm ml-2">
                    Create QuickBooks Invoice
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        </>
      )}

      {/* Section G — Photos */}
      {photos.length > 0 && (
        <>
          <SectionHeader title={`Photos (${photos.length})`} icon="camera" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {photos.map((photo) => (
              <View
                key={photo.id}
                className="w-36 h-36 bg-slate-200 rounded-2xl mr-3 items-center justify-center overflow-hidden"
              >
                <FontAwesome name="camera" size={22} color="#94A3B8" />
                <Text
                  className="text-xs text-slate-500 mt-2 px-3 text-center"
                  numberOfLines={2}
                >
                  {photo.caption}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
      {/* Section H — Customer Signature */}
      <SectionHeader title="Customer Signature" icon="pencil-square-o" />
      {job.signature ? (
        <Card>
          <View className="items-center py-2">
            <View
              className="w-full rounded-xl overflow-hidden bg-slate-50"
              style={{ height: 120 }}
            >
              <Svg width="100%" height="100%" viewBox="0 0 340 120">
                {JSON.parse(job.signature.paths).map((p: string, i: number) => (
                  <Path
                    key={i}
                    d={p}
                    stroke="#0F172A"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
            </View>
            <View className="flex-row items-center mt-3">
              <FontAwesome name="check-circle" size={12} color="#16A34A" />
              <Text className="text-xs text-slate-500 ml-1.5">
                Signed by {job.signature.signed_by} · {formatDateTime(job.signature.signed_at)}
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <Pressable
          onPress={() => {
            setSignPaths([]);
            setCurrentPath("");
            setSignerName(job.customer_name);
            setShowSignModal(true);
          }}
          className="mx-4 rounded-2xl py-4 items-center"
          style={{ backgroundColor: "#0F172A" }}
        >
          <View className="flex-row items-center">
            <FontAwesome name="pencil-square-o" size={15} color="#fff" />
            <Text className="text-white font-bold text-sm ml-2">
              Get Customer Signature
            </Text>
          </View>
        </Pressable>
      )}

      {/* Add Note Modal */}
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable
            className="flex-1"
            onPress={() => setShowNoteModal(false)}
          />
          <View
            className="bg-white rounded-t-3xl px-5 pt-6 pb-10"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <Text className="text-lg font-bold text-slate-900 mb-1">
              New Note
            </Text>
            <Text className="text-sm text-slate-400 mb-5">
              {job.customer_name} — {job.customer_address}
            </Text>

            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What did you observe or want to remember?"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              className="bg-slate-50 rounded-xl px-4 py-3.5 text-sm text-slate-900 mb-6"
              style={{ minHeight: 120 }}
              autoFocus
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText("");
                }}
                className="flex-1 py-4 rounded-2xl items-center bg-slate-100"
              >
                <Text className="text-sm font-bold text-slate-600">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddNote}
                className="flex-1 py-4 rounded-2xl items-center"
                style={{ backgroundColor: "#0F172A" }}
              >
                <View className="flex-row items-center">
                  <FontAwesome name="check" size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white ml-1.5">Save</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Report Modal */}
      <Modal visible={showEmailModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable
            className="flex-1"
            onPress={() => setShowEmailModal(false)}
          />
          <View
            className="bg-white rounded-t-3xl px-5 pt-6 pb-10"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <View className="flex-row items-center mb-1">
              <FontAwesome
                name={emailMode === "pdf" ? "file-pdf-o" : "envelope"}
                size={18}
                color={emailMode === "pdf" ? "#DC2626" : "#2563EB"}
              />
              <Text className="text-lg font-bold text-slate-900 ml-2">
                {emailMode === "pdf" ? "Detailed Report" : "Email Report"}
              </Text>
            </View>
            {emailMode === "pdf" && (
              <View className="bg-red-50 rounded-lg px-3 py-2 mb-2">
                <Text className="text-xs text-red-600">
                  Includes readings, findings, diagnosis, actions, and notes
                </Text>
              </View>
            )}
            <Text className="text-sm text-slate-400 mb-5">
              {job.customer_name} — {job.customer_address}
            </Text>

            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Recipient Email
            </Text>
            <TextInput
              value={emailTo}
              onChangeText={setEmailTo}
              placeholder="e.g. manager@company.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-slate-50 rounded-xl px-4 py-3.5 text-sm text-slate-900 mb-6"
              autoFocus
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setShowEmailModal(false);
                  setEmailTo("");
                }}
                className="flex-1 py-4 rounded-2xl items-center bg-slate-100"
              >
                <Text className="text-sm font-bold text-slate-600">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleEmailReport}
                disabled={emailSending}
                className="flex-1 py-4 rounded-2xl items-center"
                style={{ backgroundColor: emailSending ? "#93C5FD" : "#2563EB" }}
              >
                {emailSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View className="flex-row items-center">
                    <FontAwesome name="send" size={13} color="#fff" />
                    <Text className="text-sm font-bold text-white ml-1.5">
                      Send
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Signature Modal */}
      <Modal visible={showSignModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <Pressable className="flex-1" onPress={() => setShowSignModal(false)} />
          <View
            className="bg-white rounded-t-3xl px-5 pt-6 pb-10"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <Text className="text-lg font-bold text-slate-900 mb-1">
              Customer Signature
            </Text>
            <Text className="text-sm text-slate-400 mb-4">
              Please sign below to confirm the work has been completed.
            </Text>

            {/* Signer name */}
            <TextInput
              value={signerName}
              onChangeText={setSignerName}
              placeholder="Customer name"
              placeholderTextColor="#94A3B8"
              className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-900 mb-4"
            />

            {/* Signature canvas */}
            <View
              className="bg-slate-50 rounded-xl overflow-hidden border-2 border-dashed border-slate-200"
              style={{ height: 160 }}
              {...signPanResponder.panHandlers}
            >
              <Svg width="100%" height="100%">
                {signPaths.map((p, i) => (
                  <Path
                    key={i}
                    d={p}
                    stroke="#0F172A"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath ? (
                  <Path
                    d={currentPath}
                    stroke="#0F172A"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </Svg>
              {signPaths.length === 0 && !currentPath && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-sm text-slate-300">Sign here</Text>
                </View>
              )}
            </View>

            {/* Buttons */}
            <View className="flex-row gap-3 mt-5">
              <Pressable
                onPress={() => {
                  setSignPaths([]);
                  setCurrentPath("");
                }}
                className="py-4 px-5 rounded-2xl items-center bg-slate-100"
              >
                <Text className="text-sm font-bold text-slate-600">Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSignModal(false);
                  setSignPaths([]);
                }}
                className="flex-1 py-4 rounded-2xl items-center bg-slate-100"
              >
                <Text className="text-sm font-bold text-slate-600">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (signPaths.length === 0) {
                    Alert.alert("No Signature", "Please sign before saving.");
                    return;
                  }
                  if (!signerName.trim()) {
                    Alert.alert("No Name", "Please enter the customer's name.");
                    return;
                  }
                  await saveSignature(
                    job.id,
                    JSON.stringify(signPaths),
                    signerName.trim()
                  );
                  setShowSignModal(false);
                  setSignPaths([]);
                  setCurrentPath("");
                }}
                className="flex-1 py-4 rounded-2xl items-center"
                style={{ backgroundColor: "#0F172A" }}
              >
                <View className="flex-row items-center">
                  <FontAwesome name="check" size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white ml-1.5">
                    Save
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
