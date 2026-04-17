import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  ActivityIndicator,
  Share,
  Image,
  StatusBar,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { CLIP_VIDEOS, CLIP_THUMBS } from "../../data/clipAssets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Svg, { Path } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { useJobStore } from "../../store/jobStore";
import { Note, Clip, Job } from "../../types";

const SERVER = "http://10.0.0.48:3001";

// ─── PDF HTML generator ───────────────────────────────────────────

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
    <tr><td>Voltage</td><td>${readings.voltage}V</td></tr>
    <tr><td>Amperage</td><td>${readings.amperage}A</td></tr>
  `
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0F172A; font-size: 14px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; margin: 28px 0 12px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px; }
    .header { background: #0F172A; color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { color: white; font-size: 22px; }
    .header p { color: #94A3B8; margin: 4px 0 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
    table td:first-child { color: #64748B; width: 40%; }
    table td:last-child { font-weight: 600; }
  </style></head><body>
    <div class="header"><h1>Service Report</h1><p>${job.customer_name} — ${job.customer_address}</p><p>${date} · Tech: ${job.technician_name}</p></div>
    <h2>Unit</h2><p>${unit.brand} ${unit.system_type} · ${unit.tonnage}T · ${unit.refrigerant_type}</p>
    ${readings.taken_at ? `<h2>Readings</h2><table>${readingRows}</table>` : ""}
    <h2>Diagnosis</h2><p><strong>${diagnosis.primary_issue}</strong></p><p>${diagnosis.technical_summary}</p>
    <h2>Service Report</h2><p>${job.service_report || "Report pending."}</p>
  </body></html>`;
}

// ─── Helpers ────────────────────────────────────────────────────────

type ReadingStatus = "normal" | "warning" | "critical";

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "#DC2626";
    case "warning":
      return "#EA580C";
    default:
      return "#2563EB";
  }
}

function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case "emergency":
      return "#DC2626";
    case "urgent":
      return "#EA580C";
    default:
      return "#16A34A";
  }
}

function getReadingStatus(value: number, min: number, max: number): ReadingStatus {
  if (value >= min && value <= max) return "normal";
  const diff = value < min ? min - value : value - max;
  const range = max - min;
  if (diff > range * 0.5) return "critical";
  return "warning";
}

function getStatusColor(status: ReadingStatus): string {
  switch (status) {
    case "normal":
      return "#16A34A";
    case "warning":
      return "#EA580C";
    case "critical":
      return "#DC2626";
  }
}

function formatDateTime(iso: string): string {
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

function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
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

// ─── Tabs ───────────────────────────────────────────────────────────

type TabId = "overview" | "readings" | "timeline" | "report";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "readings", label: "Gauges" },
  { id: "timeline", label: "Work" },
  { id: "report", label: "Report" },
];

// ─── Screen ─────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const jobs = useJobStore((s) => s.jobs);
  const { addNote, deleteNote, deleteClip, saveSignature } = useJobStore();
  const techName = useJobStore((s) => s.techName);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMode, setEmailMode] = useState<"simple" | "pdf">("simple");
  const [emailSending, setEmailSending] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showSignModal, setShowSignModal] = useState(false);
  const [signPaths, setSignPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [signerName, setSignerName] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState<{
    docNumber: string;
    totalAmount: number;
  } | null>(null);
  const [focused, setFocused] = useState<
    | { kind: "diagnosis" }
    | { kind: "finding"; id: string }
    | null
  >(null);
  const [playingClip, setPlayingClip] = useState<Clip | null>(null);

  const tabIndicator = useRef(new Animated.Value(0)).current;

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

  const urgencyColor = useMemo(
    () => (job ? getUrgencyColor(job.diagnosis.urgency) : "#16A34A"),
    [job]
  );

  const switchTab = useCallback(
    (tab: TabId) => {
      const idx = TABS.findIndex((t) => t.id === tab);
      Animated.spring(tabIndicator, {
        toValue: idx,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }).start();
      setActiveTab(tab);
    },
    [tabIndicator]
  );

  const callCustomer = useCallback(() => {
    if (!job) return;
    Alert.alert(
      "Call Customer",
      `Call ${job.customer_name} at ${job.customer_phone}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call" },
      ]
    );
  }, [job]);

  const handleConnectGmail = async () => {
    try {
      const res = await fetch(`${SERVER}/gmail/connect`, { method: "POST" });
      const data = await res.json();
      if (data.redirectUrl) {
        await WebBrowser.openBrowserAsync(data.redirectUrl);
      } else {
        Alert.alert("Error", data.error || "Failed to start Gmail auth");
      }
    } catch {
      Alert.alert("Server Not Running", "Start the Composio server first.");
    }
  };

  const handleEmailReport = async () => {
    if (!job) return;
    if (!emailTo.trim()) {
      Alert.alert("Missing Email", "Enter a recipient email address.");
      return;
    }
    setEmailSending(true);
    try {
      const statusRes = await fetch(`${SERVER}/gmail/status`);
      const status = await statusRes.json();
      if (!status.connected) {
        setEmailSending(false);
        Alert.alert("Gmail Not Connected", "Connect your Gmail account first.", [
          { text: "Cancel", style: "cancel" },
          { text: "Connect Gmail", onPress: handleConnectGmail },
        ]);
        return;
      }

      const subject =
        emailMode === "pdf"
          ? `HVAC Detailed Service Report — ${job.customer_name} — ${formatDateTime(job.created_at)}`
          : `HVAC Service Report — ${job.customer_name} — ${formatDateTime(job.created_at)}`;

      let res: Response;
      if (emailMode === "pdf") {
        const { uri } = await Print.printToFileAsync({
          html: generateReportHTML(job),
          base64: false,
        });
        const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const filename = `hvac-report-${job.customer_name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
        const textBody = `Detailed HVAC service report for ${job.customer_name} — ${job.customer_address}\nDate: ${formatDateTime(job.created_at)}\nTechnician: ${job.technician_name}\n\nSee the attached PDF for the full diagnostic report.`;
        res = await fetch(`${SERVER}/gmail/send-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_email: emailTo.trim(),
            subject,
            body: textBody,
            pdf_base64: pdfBase64,
            filename,
          }),
        });
      } else {
        const body = `Service Report\n${job.customer_name} — ${job.customer_address}\n${formatDateTime(job.created_at)}\nTechnician: ${job.technician_name}\n\n${job.service_report}`;
        res = await fetch(`${SERVER}/gmail/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_email: emailTo.trim(),
            subject,
            body,
            is_html: false,
          }),
        });
      }
      const result = await res.json();
      setEmailSending(false);

      if (result.success) {
        setShowEmailModal(false);
        setEmailTo("");
        Alert.alert("Sent!", `Report emailed to ${emailTo.trim()}`);
      } else {
        Alert.alert("Failed", result.error || "Could not send email.");
      }
    } catch {
      setEmailSending(false);
      Alert.alert("Server Not Running", "Start the Composio server first.");
    }
  };

  const handleAddNote = async () => {
    if (!job || !noteText.trim()) return;
    await addNote(job.id, noteText, "manual", techName);
    setNoteText("");
    setShowNoteModal(false);
  };

  const handleDeleteNote = (note: Note) => {
    if (!job) return;
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
    if (!job) return;
    Alert.alert("Delete Clip", "Remove this clip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteClip(job.id, clip.id),
      },
    ]);
  };

  const handleCreateInvoice = async () => {
    if (!job) return;
    setInvoiceLoading(true);
    try {
      const statusRes = await fetch(`${SERVER}/qb/status`);
      const status = await statusRes.json();
      if (!status.connected) {
        setInvoiceLoading(false);
        Alert.alert(
          "QuickBooks Not Connected",
          "Connect QuickBooks in Settings first."
        );
        return;
      }
      const res = await fetch(`${SERVER}/qb/invoice`, {
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
      } else {
        Alert.alert("Failed", result.error || "Could not create invoice.");
      }
    } catch {
      setInvoiceLoading(false);
      Alert.alert("Server Not Running", "Start the QuickBooks server.");
    }
  };

  const openSignModal = () => {
    if (!job) return;
    setSignPaths([]);
    setCurrentPath("");
    setSignerName(job.customer_name);
    setShowSignModal(true);
  };

  const saveSig = async () => {
    if (!job) return;
    if (signPaths.length === 0) {
      Alert.alert("No Signature", "Please sign before saving.");
      return;
    }
    if (!signerName.trim()) {
      Alert.alert("No Name", "Please enter the customer's name.");
      return;
    }
    await saveSignature(job.id, JSON.stringify(signPaths), signerName.trim());
    setShowSignModal(false);
    setSignPaths([]);
    setCurrentPath("");
  };

  if (!job) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#94A3B8" }}>Job not found</Text>
      </View>
    );
  }

  const { unit, readings, findings, diagnosis, actions, photos } = job;
  const notes = job.notes || [];
  const clips = job.clips || [];

  const tabWidth = (Dimensions.get("window").width - 32) / TABS.length;
  const translateX = tabIndicator.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => i * tabWidth),
  });

  // ─── Tab renderers ─────────────────────────────────────────────

  const renderOverview = () => (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Diagnosis card */}
      <Pressable
        style={s.diagCard}
        onPress={() => setFocused({ kind: "diagnosis" })}
      >
        <View style={s.diagCardHeader}>
          <View style={s.diagCardIcon}>
            <FontAwesome name="heartbeat" size={18} color="#F59E0B" />
          </View>
          <View style={s.diagCardHeaderText}>
            <Text style={s.diagCardTitle}>{diagnosis.primary_issue}</Text>
            <Text style={s.diagCardConf}>{diagnosis.confidence} confidence</Text>
          </View>
          <View style={[s.urgBadge, { backgroundColor: urgencyColor + "18" }]}>
            <Text style={[s.urgBadgeText, { color: urgencyColor }]}>
              {diagnosis.urgency.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={s.diagCardSummary} numberOfLines={3}>
          {diagnosis.technical_summary}
        </Text>
        {diagnosis.recommended_actions.length > 0 && (
          <View style={s.diagCardActions}>
            {diagnosis.recommended_actions.slice(0, 2).map((a, i) => (
              <View key={i} style={s.diagCardActionRow}>
                <View style={s.diagDot} />
                <Text style={s.diagCardActionText} numberOfLines={1}>
                  {a}
                </Text>
              </View>
            ))}
            {diagnosis.recommended_actions.length > 2 && (
              <Text style={s.diagMore}>
                +{diagnosis.recommended_actions.length - 2} more
              </Text>
            )}
          </View>
        )}
      </Pressable>

      {findings.length > 0 &&
        findings.map((f) => (
          <Pressable
            key={f.id}
            style={s.findingCard}
            onPress={() => setFocused({ kind: "finding", id: f.id })}
          >
            <View
              style={[s.findingStripe, { backgroundColor: getSeverityColor(f.severity) }]}
            />
            <View style={s.findingBody}>
              <View style={s.findingTop}>
                <Text style={s.findingComp}>
                  {f.component.replace(/_/g, " ")}
                </Text>
                <View
                  style={[
                    s.findingSevBadge,
                    { backgroundColor: getSeverityColor(f.severity) + "18" },
                  ]}
                >
                  <Text
                    style={[s.findingSevText, { color: getSeverityColor(f.severity) }]}
                  >
                    {f.severity}
                  </Text>
                </View>
              </View>
              <Text style={s.findingDesc} numberOfLines={2}>
                {f.description}
              </Text>
            </View>
          </Pressable>
        ))}

      {/* Unit card */}
      <Pressable onPress={() => router.push(`/unit/${unit.serial_number}`)}>
        <View style={s.unitCard}>
          <View style={s.unitAv}>
            <Text style={s.unitAvText}>{unit.brand.charAt(0)}</Text>
          </View>
          <View style={s.unitMid}>
            <Text style={s.unitBrand}>
              {unit.brand} {unit.system_type}
            </Text>
            <Text style={s.unitModelText} numberOfLines={1}>
              {unit.model_number}
            </Text>
          </View>
          <View style={s.unitRight}>
            <Text style={s.unitTonnage}>{unit.tonnage}T</Text>
            <Text style={s.unitRefrig}>{unit.refrigerant_type}</Text>
          </View>
        </View>
      </Pressable>

      {/* Quick grid */}
      <View style={s.quickGrid}>
        <Pressable
          style={s.quickItem}
          onPress={() => router.push(`/notes/${job.id}`)}
        >
          <View style={[s.quickIconWrap, { backgroundColor: "#EFF6FF" }]}>
            <FontAwesome name="sticky-note-o" size={18} color="#2563EB" />
          </View>
          <Text style={s.quickCount}>{notes.length}</Text>
          <Text style={s.quickLabel}>Notes</Text>
        </Pressable>
        <Pressable style={s.quickItem}>
          <View style={[s.quickIconWrap, { backgroundColor: "#F0FDFA" }]}>
            <FontAwesome name="camera" size={18} color="#0D9488" />
          </View>
          <Text style={s.quickCount}>{photos.length}</Text>
          <Text style={s.quickLabel}>Photos</Text>
        </Pressable>
        <Pressable
          style={s.quickItem}
          onPress={() => router.push(`/clips/${job.id}`)}
        >
          <View style={[s.quickIconWrap, { backgroundColor: "#FEF2F2" }]}>
            <FontAwesome name="video-camera" size={18} color="#DC2626" />
          </View>
          <Text style={s.quickCount}>{clips.length}</Text>
          <Text style={s.quickLabel}>Clips</Text>
        </Pressable>
        <Pressable style={s.quickItem} onPress={() => switchTab("timeline")}>
          <View style={[s.quickIconWrap, { backgroundColor: "#ECFEFF" }]}>
            <FontAwesome name="bolt" size={18} color="#0891B2" />
          </View>
          <Text style={s.quickCount}>{actions.length}</Text>
          <Text style={s.quickLabel}>Actions</Text>
        </Pressable>
      </View>

      {job.story && (
        <Pressable
          style={s.storyBanner}
          onPress={() => router.push(`/story/${job.id}`)}
        >
          <View style={s.storyBannerIcon}>
            <FontAwesome name="film" size={20} color="#FFF" />
          </View>
          <View style={s.storyBannerContent}>
            <Text style={s.storyBannerTitle}>Job Story</Text>
            <Text style={s.storyBannerSub}>
              {job.story.segments.length} moments captured
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#64748B" />
        </Pressable>
      )}

      <Pressable
        style={[s.storyBanner, { marginTop: 10, backgroundColor: "#1E3A5F" }]}
        onPress={() => router.push(`/job/automate/${job.id}`)}
      >
        <View style={s.storyBannerIcon}>
          <FontAwesome name="bolt" size={18} color="#FFF" />
        </View>
        <View style={s.storyBannerContent}>
          <Text style={s.storyBannerTitle}>Automate</Text>
          <Text style={[s.storyBannerSub, { color: "#BFDBFE" }]}>
            Trigger reports & invoices when job completes
          </Text>
        </View>
        <FontAwesome name="chevron-right" size={16} color="#BFDBFE" />
      </Pressable>
    </ScrollView>
  );

  const renderGauge = (
    label: string,
    value: number,
    unitStr: string,
    status: ReadingStatus,
    target?: string
  ) => {
    const color = getStatusColor(status);
    const isOff = status !== "normal";
    return (
      <View style={s.gaugeCard}>
        <View style={s.gaugeTop}>
          <Text style={s.gaugeLabel}>{label}</Text>
          <View style={[s.gaugeDot, { backgroundColor: color }]} />
        </View>
        <View style={s.gaugeValRow}>
          <Text style={[s.gaugeVal, isOff && { color }]}>{value}</Text>
          <Text style={s.gaugeUnit}>{unitStr}</Text>
        </View>
        {target && <Text style={s.gaugeTarget}>Target: {target}</Text>}
      </View>
    );
  };

  const renderReadings = () => (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {!readings.taken_at ? (
        <View style={s.emptyReport}>
          <FontAwesome name="dashboard" size={40} color="#CBD5E1" />
          <Text style={s.emptyReportTitle}>No Readings Yet</Text>
          <Text style={s.emptyReportDesc}>
            Gauges appear once the tech logs readings.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.gaugeSection}>
            <Text style={s.gaugeSectionTitle}>Pressure</Text>
            <View style={s.gaugeRow}>
              {renderGauge(
                "High Side",
                readings.high_side_psi,
                "PSI",
                getReadingStatus(readings.high_side_psi, 200, 420)
              )}
              {renderGauge(
                "Low Side",
                readings.low_side_psi,
                "PSI",
                getReadingStatus(readings.low_side_psi, 57, 140)
              )}
            </View>
          </View>
          <View style={s.gaugeSection}>
            <Text style={s.gaugeSectionTitle}>Temperature</Text>
            <View style={s.gaugeRow}>
              {renderGauge(
                "Superheat",
                readings.superheat_f,
                "°F",
                getReadingStatus(readings.superheat_f, 10, 15),
                "10-15"
              )}
              {renderGauge(
                "Subcooling",
                readings.subcooling_f,
                "°F",
                getReadingStatus(readings.subcooling_f, 8, 12),
                "8-12"
              )}
            </View>
            <View style={s.gaugeRow}>
              {renderGauge(
                "Delta T",
                readings.delta_t_f,
                "°F",
                getReadingStatus(readings.delta_t_f, 16, 22),
                "16-22"
              )}
              {renderGauge("Outdoor", readings.outdoor_temp_f, "°F", "normal")}
            </View>
          </View>
          <View style={s.gaugeSection}>
            <Text style={s.gaugeSectionTitle}>Electrical</Text>
            <View style={s.gaugeRow}>
              {renderGauge(
                "Voltage",
                readings.voltage,
                "V",
                getReadingStatus(readings.voltage, 210, 250)
              )}
              {renderGauge("Amperage", readings.amperage, "A", "normal")}
            </View>
          </View>
          {readings.static_pressure_in_wc > 0 && (
            <View style={s.gaugeSection}>
              <Text style={s.gaugeSectionTitle}>Airflow</Text>
              <View style={s.gaugeRow}>
                {renderGauge(
                  "Static Press.",
                  readings.static_pressure_in_wc,
                  "in.wc",
                  getReadingStatus(readings.static_pressure_in_wc, 0.2, 0.5),
                  "0.2-0.5"
                )}
                <View style={s.gaugeCard} />
              </View>
            </View>
          )}
          <Text style={s.readingTimestamp}>
            Taken {formatDateTime(readings.taken_at)}
          </Text>
        </>
      )}
    </ScrollView>
  );

  const renderTimeline = () => (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {actions.map((action, i) => (
        <View key={action.id} style={s.tlItem}>
          <View style={s.tlLeft}>
            <View style={s.tlDot}>
              <FontAwesome
                name={getActionIcon(action.type)}
                size={12}
                color="#FFF"
              />
            </View>
            {i < actions.length - 1 && <View style={s.tlLine} />}
          </View>
          <View style={s.tlContent}>
            <Text style={s.tlTime}>{formatTime(action.timestamp)}</Text>
            <Text style={s.tlDesc}>{action.description}</Text>
            {action.quantity > 0 && (
              <Text style={s.tlQty}>
                {action.quantity} {action.unit}
              </Text>
            )}
          </View>
        </View>
      ))}

      <View style={s.tlSectionDivider}>
        <Text style={s.tlSectionLabel}>NOTES ({notes.length})</Text>
      </View>
      {notes.slice(0, 2).map((note) => (
        <Pressable
          key={note.id}
          onLongPress={() => handleDeleteNote(note)}
          style={s.notePreview}
        >
          <View style={s.notePreviewIcon}>
            <FontAwesome
              name={note.source === "vision" ? "eye" : "pencil"}
              size={13}
              color={note.source === "vision" ? "#06B6D4" : "#64748B"}
            />
          </View>
          <View style={s.notePreviewContent}>
            <Text style={s.notePreviewText} numberOfLines={2}>
              {note.text}
            </Text>
            <Text style={s.notePreviewMeta}>
              {note.created_by} · {formatTime(note.created_at)}
            </Text>
          </View>
        </Pressable>
      ))}
      <Pressable
        style={s.viewAllBtn}
        onPress={() => router.push(`/notes/${job.id}`)}
      >
        <Text style={s.viewAllText}>View all notes</Text>
        <FontAwesome name="chevron-right" size={12} color="#06B6D4" />
      </Pressable>

      {clips.length > 0 && (
        <>
          <View style={s.tlSectionDivider}>
            <Text style={s.tlSectionLabel}>CLIPS ({clips.length})</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.clipScroll}
          >
            {clips.map((clip) => {
              const thumbAsset = CLIP_THUMBS[clip.id];
              const thumbSource = thumbAsset
                ? thumbAsset
                : clip.thumbnail_path
                ? { uri: clip.thumbnail_path }
                : null;
              return (
                <Pressable
                  key={clip.id}
                  onPress={() => setPlayingClip(clip)}
                  onLongPress={() => handleDeleteClip(clip)}
                  style={s.clipThumb}
                >
                  <View style={s.clipThumbBg}>
                    {thumbSource && (
                      <Image
                        source={thumbSource}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                        }}
                        resizeMode="cover"
                      />
                    )}
                    <View style={s.clipPlayBtn}>
                      <FontAwesome name="play" size={14} color="#FFF" />
                    </View>
                    <View style={s.clipDurBadge}>
                      <Text style={s.clipDurText}>
                        {formatDuration(clip.duration_seconds)}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.clipThumbCap} numberOfLines={1}>
                    {clip.caption || "Untitled clip"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {photos.length > 0 && (
        <>
          <View style={s.tlSectionDivider}>
            <Text style={s.tlSectionLabel}>PHOTOS ({photos.length})</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.clipScroll}
          >
            {photos.map((photo) => (
              <View key={photo.id} style={s.photoThumb}>
                <View style={s.photoThumbBg}>
                  <FontAwesome name="camera" size={20} color="#94A3B8" />
                </View>
                <Text style={s.photoThumbCap} numberOfLines={1}>
                  {photo.caption}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </ScrollView>
  );

  const renderReport = () => (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {job.service_report ? (
        <View style={s.reportCard}>
          <Text style={s.reportText}>{job.service_report}</Text>
        </View>
      ) : (
        <View style={s.emptyReport}>
          <FontAwesome name="file-text-o" size={40} color="#CBD5E1" />
          <Text style={s.emptyReportTitle}>No Report Yet</Text>
          <Text style={s.emptyReportDesc}>
            Report will be generated when the job is completed.
          </Text>
        </View>
      )}

      {job.service_report && (
        <View style={s.reportBtns}>
          <Pressable
            style={s.reportBtnPrimary}
            onPress={() => {
              setEmailMode("simple");
              setShowEmailModal(true);
            }}
          >
            <FontAwesome name="envelope-o" size={16} color="#FFF" />
            <Text style={s.reportBtnPrimaryText}>Email Summary</Text>
          </Pressable>
          <Pressable
            style={s.reportBtnSecondary}
            onPress={() => {
              setEmailMode("pdf");
              setShowEmailModal(true);
            }}
          >
            <FontAwesome name="file-pdf-o" size={16} color="#0F172A" />
            <Text style={s.reportBtnSecondaryText}>Detailed PDF</Text>
          </Pressable>
        </View>
      )}

      {job.status === "completed" && (
        <View style={[s.sigSection, { marginBottom: 12 }]}>
          <Text style={s.sigSectionTitle}>Invoice</Text>
          {invoiceCreated ? (
            <View style={s.sigDone}>
              <FontAwesome name="check-circle" size={18} color="#16A34A" />
              <Text style={s.sigDoneText}>
                Invoice #{invoiceCreated.docNumber} · ${invoiceCreated.totalAmount}
              </Text>
            </View>
          ) : (
            <Pressable
              style={s.sigCollectBtn}
              onPress={handleCreateInvoice}
              disabled={invoiceLoading}
            >
              {invoiceLoading ? (
                <ActivityIndicator size="small" color="#16A34A" />
              ) : (
                <FontAwesome name="book" size={18} color="#16A34A" />
              )}
              <View style={s.sigCollectContent}>
                <Text style={s.sigCollectTitle}>Create QuickBooks Invoice</Text>
                <Text style={s.sigCollectDesc}>Sync job to QuickBooks</Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color="#CBD5E1" />
            </Pressable>
          )}
        </View>
      )}

      <View style={s.sigSection}>
        <Text style={s.sigSectionTitle}>Customer Signature</Text>
        {job.signature ? (
          <View>
            <View
              style={{
                height: 120,
                backgroundColor: "#F8FAFC",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 10,
              }}
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
            <View style={s.sigDone}>
              <FontAwesome name="check-circle" size={18} color="#16A34A" />
              <Text style={s.sigDoneText}>
                Signed by {job.signature.signed_by}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable style={s.sigCollectBtn} onPress={openSignModal}>
            <FontAwesome name="pencil-square-o" size={18} color="#06B6D4" />
            <View style={s.sigCollectContent}>
              <Text style={s.sigCollectTitle}>Collect Signature</Text>
              <Text style={s.sigCollectDesc}>Tap to open signature pad</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="#CBD5E1" />
          </Pressable>
        )}
      </View>
    </ScrollView>
  );

  // ─── Main return ────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <FontAwesome name="chevron-left" size={14} color="#FFF" />
          </Pressable>
          <View style={s.headerLeft}>
            <Text style={s.custName}>{job.customer_name}</Text>
            <View style={s.addrRow}>
              <FontAwesome name="map-marker" size={11} color="#64748B" />
              <Text style={s.addrText} numberOfLines={1}>
                {job.customer_address}
              </Text>
            </View>
          </View>
          <View style={s.headerRight}>
            {job.status === "in_progress" ? (
              <View style={s.liveBadge}>
                <View style={s.liveDotSmall} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
            ) : (
              <View
                style={[s.urgBadgeSmall, { backgroundColor: urgencyColor + "20" }]}
              >
                <Text style={[s.urgBadgeSmallText, { color: urgencyColor }]}>
                  {diagnosis.urgency.toUpperCase()}
                </Text>
              </View>
            )}
            <Pressable style={s.callBtn} onPress={callCustomer}>
              <FontAwesome name="phone" size={14} color="#06B6D4" />
            </Pressable>
          </View>
        </View>

        <View style={s.metaChips}>
          <View style={s.chip}>
            <FontAwesome name="clock-o" size={10} color="#94A3B8" />
            <Text style={s.chipText}>{job.duration_minutes}m</Text>
          </View>
          <View style={s.chip}>
            <FontAwesome name="hourglass-half" size={10} color="#94A3B8" />
            <Text style={s.chipText}>{formatDateTime(job.created_at)}</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipTextTeal}>
              {unit.brand} {unit.tonnage}T
            </Text>
          </View>
        </View>

        <View style={s.tabBar}>
          <Animated.View
            style={[
              s.tabIndicator,
              {
                width: tabWidth - 8,
                transform: [{ translateX: Animated.add(translateX, 4) }],
              },
            ]}
          />
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={s.tabBtn}
              onPress={() => switchTab(tab.id)}
            >
              <Text
                style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.content}>
        {activeTab === "overview" && renderOverview()}
        {activeTab === "readings" && renderReadings()}
        {activeTab === "timeline" && renderTimeline()}
        {activeTab === "report" && renderReport()}
      </View>

      {/* Bottom bar */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {!job.signature ? (
          <Pressable style={s.bottomPrimary} onPress={openSignModal}>
            <FontAwesome name="pencil-square-o" size={16} color="#FFF" />
            <Text style={s.bottomPrimaryText}>Collect Signature</Text>
          </Pressable>
        ) : (
          <Pressable
            style={s.bottomPrimary}
            onPress={() => {
              setEmailMode("simple");
              setShowEmailModal(true);
            }}
          >
            <FontAwesome name="send" size={16} color="#FFF" />
            <Text style={s.bottomPrimaryText}>Send Report</Text>
          </Pressable>
        )}
        <Pressable style={s.bottomSecondary} onPress={() => setShowNoteModal(true)}>
          <FontAwesome name="plus" size={18} color="#0F172A" />
        </Pressable>
      </View>

      {/* Focus Modal (diagnosis / finding) */}
      <Modal
        visible={focused !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setFocused(null)}
      >
        <BlurView intensity={40} tint="dark" style={s.focusBackdrop}>
          <Pressable
            style={{ flex: 1, width: "100%" }}
            onPress={() => setFocused(null)}
          />
          <View style={s.focusSheet}>
            {focused?.kind === "diagnosis" && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.focusHeader}>
                  <View style={s.diagCardIcon}>
                    <FontAwesome name="heartbeat" size={18} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.focusTitle}>{diagnosis.primary_issue}</Text>
                    <Text style={s.diagCardConf}>
                      {diagnosis.confidence} confidence
                    </Text>
                  </View>
                  <View
                    style={[
                      s.urgBadge,
                      { backgroundColor: urgencyColor + "18" },
                    ]}
                  >
                    <Text
                      style={[s.urgBadgeText, { color: urgencyColor }]}
                    >
                      {diagnosis.urgency.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={s.focusSectionLabel}>Technical Summary</Text>
                <Text style={s.focusBody}>{diagnosis.technical_summary}</Text>
                {diagnosis.recommended_actions.length > 0 && (
                  <>
                    <Text style={s.focusSectionLabel}>Recommended Actions</Text>
                    {diagnosis.recommended_actions.map((a, i) => (
                      <View key={i} style={s.focusActionRow}>
                        <View style={s.focusActionNum}>
                          <Text style={s.focusActionNumText}>{i + 1}</Text>
                        </View>
                        <Text style={s.focusActionText}>{a}</Text>
                      </View>
                    ))}
                  </>
                )}
                {diagnosis.parts_needed.length > 0 && (
                  <>
                    <Text style={s.focusSectionLabel}>Parts Needed</Text>
                    {diagnosis.parts_needed.map((p, i) => (
                      <View key={i} style={s.focusPartRow}>
                        <Text style={s.focusPartName}>{p.name}</Text>
                        <Text style={s.focusPartSpec}>{p.spec}</Text>
                        <Text style={s.focusPartReason}>{p.reason}</Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}

            {focused?.kind === "finding" &&
              (() => {
                const f = findings.find((x) => x.id === focused.id);
                if (!f) return null;
                const color = getSeverityColor(f.severity);
                return (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={s.focusHeader}>
                      <View
                        style={[
                          s.diagCardIcon,
                          { backgroundColor: color + "18" },
                        ]}
                      >
                        <FontAwesome
                          name="exclamation-circle"
                          size={18}
                          color={color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.focusTitle}>
                          {f.component.replace(/_/g, " ")}
                        </Text>
                        <Text style={s.diagCardConf}>
                          {f.type.replace(/_/g, " ")}
                        </Text>
                      </View>
                      <View
                        style={[
                          s.urgBadge,
                          { backgroundColor: color + "18" },
                        ]}
                      >
                        <Text style={[s.urgBadgeText, { color }]}>
                          {f.severity.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.focusSectionLabel}>Details</Text>
                    <Text style={s.focusBody}>{f.description}</Text>
                  </ScrollView>
                );
              })()}

            <Pressable
              style={s.focusCloseBtn}
              onPress={() => setFocused(null)}
            >
              <Text style={s.focusCloseText}>Close</Text>
            </Pressable>
          </View>
        </BlurView>
      </Modal>

      {/* Clip Player Modal */}
      <Modal
        visible={playingClip !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPlayingClip(null)}
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" />
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.95)",
            justifyContent: "center",
          }}
        >
          <Pressable
            onPress={() => setPlayingClip(null)}
            style={{
              position: "absolute",
              top: 56,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
            hitSlop={16}
          >
            <FontAwesome name="times" size={18} color="#FFF" />
          </Pressable>
          {playingClip && (
            <>
              <Video
                source={
                  CLIP_VIDEOS[playingClip.id]
                    ? CLIP_VIDEOS[playingClip.id]
                    : { uri: playingClip.file_path }
                }
                style={{ width: "100%", aspectRatio: 16 / 9 }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
              />
              <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 15,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  {playingClip.caption || "Untitled clip"}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  {playingClip.recorded_by} ·{" "}
                  {formatDuration(playingClip.duration_seconds)}
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Email Modal */}
      <Modal
        visible={showEmailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalCont}
        >
          <View style={s.modalHdr}>
            <Pressable onPress={() => setShowEmailModal(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={s.modalTitleText}>
              {emailMode === "pdf" ? "Send Report" : "Email Summary"}
            </Text>
            <Pressable onPress={handleEmailReport} disabled={emailSending}>
              {emailSending ? (
                <ActivityIndicator size="small" color="#06B6D4" />
              ) : (
                <Text style={s.modalSend}>Send</Text>
              )}
            </Pressable>
          </View>
          <View style={s.modalBody}>
            <Text style={s.modalLabel}>Recipient Email</Text>
            <TextInput
              style={s.modalInput}
              placeholder="customer@email.com"
              placeholderTextColor="#CBD5E1"
              value={emailTo}
              onChangeText={setEmailTo}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={s.modalPrev}>
              <View style={s.modalPrevHdr}>
                <FontAwesome name="envelope-o" size={13} color="#64748B" />
                <Text style={s.modalPrevTitle}>Preview</Text>
              </View>
              <Text style={s.modalPrevText} numberOfLines={5}>
                {emailMode === "pdf"
                  ? `Full diagnostic report for ${job.customer_name}'s ${unit.brand} system.`
                  : job.service_report}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Note Modal */}
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowNoteModal(false)}
          />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>New Note</Text>
            <Text style={s.sheetSubtitle}>
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
              style={s.sheetInput}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText("");
                }}
                style={s.sheetBtnSecondary}
              >
                <Text style={s.sheetBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAddNote} style={s.sheetBtnPrimary}>
                <FontAwesome name="check" size={13} color="#FFF" />
                <Text style={s.sheetBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Signature Modal */}
      <Modal visible={showSignModal} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowSignModal(false)}
          />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Customer Signature</Text>
            <Text style={s.sheetSubtitle}>
              Please sign below to confirm the work has been completed.
            </Text>
            <TextInput
              value={signerName}
              onChangeText={setSignerName}
              placeholder="Customer name"
              placeholderTextColor="#94A3B8"
              style={[s.sheetInput, { minHeight: 0, marginBottom: 14 }]}
            />
            <View
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: 12,
                overflow: "hidden",
                borderWidth: 2,
                borderColor: "#E2E8F0",
                borderStyle: "dashed",
                height: 160,
                marginBottom: 16,
              }}
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
                  <Text style={{ color: "#CBD5E1" }}>Sign here</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => {
                  setSignPaths([]);
                  setCurrentPath("");
                }}
                style={s.sheetBtnSecondary}
              >
                <Text style={s.sheetBtnSecondaryText}>Clear</Text>
              </Pressable>
              <Pressable onPress={saveSig} style={s.sheetBtnPrimary}>
                <FontAwesome name="check" size={13} color="#FFF" />
                <Text style={s.sheetBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },

  header: { backgroundColor: "#1E3A5F", paddingHorizontal: 16, paddingBottom: 0 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  custName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.3,
  },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  addrText: { fontSize: 13, color: "#64748B", flex: 1 },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#06B6D420",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#06B6D4",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#06B6D4",
    letterSpacing: 0.8,
  },
  urgBadgeSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  urgBadgeSmallText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  metaChips: { flexDirection: "row", gap: 6, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chipText: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  chipTextTeal: { fontSize: 11, color: "#06B6D4", fontWeight: "600" },

  tabBar: {
    flexDirection: "row",
    marginTop: 14,
    marginBottom: 0,
    position: "relative",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    backgroundColor: "#06B6D4",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  tabLabelActive: { color: "#FFFFFF" },

  content: { flex: 1 },
  tabScroll: { flex: 1 },
  tabContent: { padding: 16, paddingBottom: 24 },

  diagCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  diagCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  diagCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  diagCardHeaderText: { flex: 1 },
  diagCardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  diagCardConf: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
    textTransform: "capitalize",
  },
  urgBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  urgBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  diagCardSummary: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 12,
  },
  diagCardActions: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  diagCardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  diagDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#06B6D4" },
  diagCardActionText: { fontSize: 12, color: "#64748B", flex: 1 },
  diagMore: { fontSize: 12, color: "#06B6D4", fontWeight: "600", marginTop: 4 },

  findingCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  findingStripe: { width: 4 },
  findingBody: { flex: 1, padding: 14 },
  findingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  findingComp: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textTransform: "capitalize",
  },
  findingSevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  findingSevText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  findingDesc: { fontSize: 13, color: "#64748B", lineHeight: 19 },

  unitCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  unitAv: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  unitAvText: { fontSize: 20, fontWeight: "900", color: "#64748B" },
  unitMid: { flex: 1 },
  unitBrand: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  unitModelText: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  unitRight: { alignItems: "flex-end" },
  unitTonnage: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  unitRefrig: {
    fontSize: 11,
    color: "#06B6D4",
    fontWeight: "600",
    marginTop: 2,
  },

  quickGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  quickItem: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickCount: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  quickLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  storyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  storyBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF15",
    alignItems: "center",
    justifyContent: "center",
  },
  storyBannerContent: { flex: 1 },
  storyBannerTitle: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  storyBannerSub: { fontSize: 12, color: "#64748B", marginTop: 2 },

  gaugeSection: { marginBottom: 20 },
  gaugeSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  gaugeRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  gaugeCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  gaugeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gaugeLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  gaugeDot: { width: 8, height: 8, borderRadius: 4 },
  gaugeValRow: { flexDirection: "row", alignItems: "baseline" },
  gaugeVal: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -1,
  },
  gaugeUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    marginLeft: 3,
  },
  gaugeTarget: {
    fontSize: 10,
    color: "#CBD5E1",
    marginTop: 6,
    fontWeight: "500",
  },
  readingTimestamp: {
    fontSize: 11,
    color: "#CBD5E1",
    textAlign: "center",
    marginTop: 4,
  },

  tlItem: { flexDirection: "row", minHeight: 72 },
  tlLeft: { width: 36, alignItems: "center" },
  tlDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  tlLine: { width: 2, flex: 1, backgroundColor: "#E2E8F0", marginTop: 4 },
  tlContent: { flex: 1, marginLeft: 12, paddingBottom: 20 },
  tlTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 4,
  },
  tlDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0F172A",
    lineHeight: 20,
  },
  tlQty: { fontSize: 12, color: "#64748B", marginTop: 4, fontWeight: "500" },
  tlSectionDivider: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 8,
  },
  tlSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
  },

  notePreview: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  notePreviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  notePreviewContent: { flex: 1 },
  notePreviewText: { fontSize: 13, color: "#334155", lineHeight: 19 },
  notePreviewMeta: { fontSize: 11, color: "#CBD5E1", marginTop: 4 },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 4,
  },
  viewAllText: { fontSize: 13, fontWeight: "600", color: "#06B6D4" },

  clipScroll: { gap: 10, paddingBottom: 4 },
  clipThumb: {
    width: 130,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  clipThumbBg: {
    height: 80,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  clipPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF30",
    alignItems: "center",
    justifyContent: "center",
  },
  clipDurBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#00000080",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clipDurText: {
    fontSize: 9,
    color: "#FFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  clipThumbCap: {
    fontSize: 11,
    color: "#334155",
    padding: 8,
    fontWeight: "500",
  },

  photoThumb: {
    width: 130,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  photoThumbBg: {
    height: 80,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  photoThumbCap: {
    fontSize: 11,
    color: "#334155",
    padding: 8,
    fontWeight: "500",
  },

  reportCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportText: { fontSize: 14, color: "#475569", lineHeight: 22 },
  emptyReport: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyReportTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#334155",
    marginTop: 8,
  },
  emptyReportDesc: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 260,
  },
  reportBtns: { gap: 10, marginBottom: 20 },
  reportBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
  },
  reportBtnPrimaryText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  reportBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
  },
  reportBtnSecondaryText: { fontSize: 15, fontWeight: "600", color: "#0F172A" },

  sigSection: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sigSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  sigDone: { flexDirection: "row", alignItems: "center", gap: 10 },
  sigDoneText: { fontSize: 15, fontWeight: "600", color: "#16A34A" },
  sigCollectBtn: { flexDirection: "row", alignItems: "center", gap: 12 },
  sigCollectContent: { flex: 1 },
  sigCollectTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  sigCollectDesc: { fontSize: 12, color: "#94A3B8", marginTop: 2 },

  bottomBar: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 10,
  },
  bottomPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
  },
  bottomPrimaryText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  bottomSecondary: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCont: { flex: 1, backgroundColor: "#FFF" },
  modalHdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalCancel: { fontSize: 16, color: "#64748B", fontWeight: "500" },
  modalTitleText: { fontSize: 17, fontWeight: "700", color: "#0F172A" },
  modalSend: { fontSize: 16, color: "#06B6D4", fontWeight: "700" },
  modalBody: { padding: 20 },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0F172A",
  },
  modalPrev: {
    marginTop: 24,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 16,
  },
  modalPrevHdr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  modalPrevTitle: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  modalPrevText: { fontSize: 13, color: "#94A3B8", lineHeight: 20 },

  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  sheetSubtitle: { fontSize: 13, color: "#94A3B8", marginBottom: 18 },
  sheetInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: "#0F172A",
    minHeight: 120,
    marginBottom: 20,
  },
  sheetBtnSecondary: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  sheetBtnSecondaryText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  sheetBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    gap: 6,
  },
  sheetBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#FFF" },

  focusBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  focusSheet: {
    position: "absolute",
    left: 20,
    right: 20,
    maxHeight: "80%",
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 20,
  },
  focusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  focusTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textTransform: "capitalize",
  },
  focusSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },
  focusBody: { fontSize: 14, color: "#475569", lineHeight: 22 },
  focusActionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  focusActionNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1E3A5F",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  focusActionNumText: { fontSize: 11, fontWeight: "800", color: "#FFF" },
  focusActionText: {
    flex: 1,
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
  },
  focusPartRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  focusPartName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  focusPartSpec: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  focusPartReason: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
  focusCloseBtn: {
    marginTop: 20,
    backgroundColor: "#1E3A5F",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  focusCloseText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
});
