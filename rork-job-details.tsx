import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  PanResponder,
  GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { FontAwesome } from "@expo/vector-icons";

/* ─────────────────────────────────────────────────────────────
   HARDCODED JOB DATA — John Smith (from seedData job-001)
   Everything this screen needs is inlined here so the file
   renders standalone with no store / router / server deps.
   ───────────────────────────────────────────────────────────── */

const job = {
  id: "job-001",
  source: "jobber" as const,
  status: "in_progress" as const,
  created_at: "2026-04-06T09:15:00Z",
  completed_at: "2026-04-06T10:02:00Z",
  duration_minutes: 47,
  customer_address: "1847 Willow Creek Dr, San Jose, CA 95125",
  customer_name: "John Smith",
  customer_phone: "408-555-1234",
  technician_id: "tech-001",
  technician_name: "Mike Torres",
  unit: {
    model_number: "4A6H6LFA048000AAAA",
    serial_number: "1122A12345",
    manufacture_date: "November 2022",
    age_years: 3.4,
    brand: "Carrier",
    refrigerant_type: "R-410A",
    system_type: "Split",
    tonnage: 4.0,
  },
  readings: {
    high_side_psi: 390,
    low_side_psi: 65,
    suction_line_temp_f: 52,
    liquid_line_temp_f: 95,
    superheat_f: 19,
    subcooling_f: 11,
    supply_air_temp_f: 57,
    return_air_temp_f: 75,
    delta_t_f: 18,
    voltage: 240,
    amperage: 14.2,
    static_pressure_in_wc: 0.42,
    outdoor_temp_f: 88,
    taken_at: "2026-04-06T09:30:00Z",
  },
  findings: [
    {
      id: "f-001-1",
      type: "refrigerant_leak_suspected",
      severity: "warning",
      description:
        "Oil staining detected at Schrader valve connection on suction line. Indicates slow refrigerant leak at service port.",
      component: "service_valve",
    },
  ],
  diagnosis: {
    primary_issue: "System undercharged",
    confidence: "high",
    technical_summary:
      "Superheat of 19°F against target 10-15°F indicates refrigerant loss. Subcooling normal at 11°F suggests a small leak rather than a metering device issue. Oil staining at Schrader valve confirms leak location.",
    recommended_actions: [
      "Tighten Schrader valve core at suction service port",
      "Add R-410A refrigerant slowly while monitoring superheat",
      "Target superheat of 12°F before stopping charge",
      "Verify subcooling stays within 8-12°F range",
    ],
    parts_needed: [] as { name: string; spec: string; reason: string }[],
    urgency: "urgent",
  },
  actions: [
    {
      id: "a-001-1",
      type: "repair_made",
      description: "Tightened Schrader valve core — minor leak found",
      quantity: 1,
      unit: "each",
      part_number: "",
      timestamp: "2026-04-06T09:45:00Z",
    },
    {
      id: "a-001-2",
      type: "refrigerant_added",
      description: "Added R-410A refrigerant",
      quantity: 1.2,
      unit: "lbs",
      part_number: "",
      timestamp: "2026-04-06T09:52:00Z",
    },
    {
      id: "a-001-3",
      type: "adjusted",
      description: "Verified superheat at 12°F after charge — within target range",
      quantity: 0,
      unit: "",
      part_number: "",
      timestamp: "2026-04-06T09:58:00Z",
    },
  ],
  service_report:
    "Service performed on Carrier 4-ton split system at 1847 Willow Creek Dr. System was running but not cooling effectively. Found superheat at 19°F (target 10-15°F) indicating low refrigerant charge. Located oil staining at suction line Schrader valve — minor leak at service port. Tightened valve core and added 1.2 lbs R-410A. Verified superheat at 12°F and subcooling at 11°F after charge. System operating within normal parameters. Recommend monitoring for any further charge loss at next maintenance visit.",
  photos: [
    {
      id: "p-001-1",
      file_path: "",
      type: "nameplate",
      caption: "Carrier nameplate showing model 4A6H6LFA048, R-410A refrigerant",
      taken_at: "2026-04-06T09:18:00Z",
    },
    {
      id: "p-001-2",
      file_path: "",
      type: "general",
      caption: "Oil staining at suction line Schrader valve",
      taken_at: "2026-04-06T09:35:00Z",
    },
  ],
  notes: [
    {
      id: "n-001-1",
      text: "Customer mentioned hearing a hissing sound near the outdoor unit for the past 2 weeks. Matches the Schrader valve leak we found.",
      source: "manual",
      created_at: "2026-04-06T09:20:00Z",
      created_by: "Mike Torres",
    },
    {
      id: "n-001-2",
      text: "Oil residue detected around service valve connection on suction line — consistent with slow refrigerant leak.",
      source: "vision",
      created_at: "2026-04-06T09:32:00Z",
      created_by: "Mike Torres",
    },
    {
      id: "n-001-3",
      text: "Homeowner says they had another company out 6 months ago for the same issue. Previous tech may not have tightened the valve core properly.",
      source: "manual",
      created_at: "2026-04-06T09:55:00Z",
      created_by: "Mike Torres",
    },
  ],
  clips: [
    {
      id: "c-001-1",
      caption: "Oil stain close-up at Schrader valve",
      duration_seconds: 18,
      recorded_at: "2026-04-06T09:33:00Z",
    },
    {
      id: "c-001-2",
      caption: "Manifold gauges after recharge",
      duration_seconds: 24,
      recorded_at: "2026-04-06T09:59:00Z",
    },
  ],
  story: {
    id: "story-001",
    job_id: "job-001",
    segments: new Array(7).fill(0), // length used only for display
  },
  signature: null as null | { paths: string; signed_by: string; signed_at: string },
};

/* ── Helpers ─────────────────────────────────────────────── */

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

function getSeverityIcon(
  severity: string
): React.ComponentProps<typeof FontAwesome>["name"] {
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

function getActionIcon(
  type: string
): React.ComponentProps<typeof FontAwesome>["name"] {
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

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── Section primitives ──────────────────────────────────── */

function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon?: React.ComponentProps<typeof FontAwesome>["name"];
}) {
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

function Card({
  children,
  noPadding,
}: {
  children: React.ReactNode;
  noPadding?: boolean;
}) {
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
        <Text
          className="text-xl font-bold"
          style={{ color: status === "normal" ? "#0F172A" : color }}
        >
          {value}
        </Text>
        <Text className="text-xs font-medium text-slate-400 ml-0.5">
          {unit}
        </Text>
      </View>
      {target && <Text className="text-xs text-slate-300 mt-1">{target}</Text>}
      <View
        className="w-1.5 h-1.5 rounded-full mt-2"
        style={{ backgroundColor: color }}
      />
    </View>
  );
}

/* ── Main Screen ─────────────────────────────────────────── */

export default function JobDetailScreen() {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMode, setEmailMode] = useState<"simple" | "pdf">("simple");
  const [showSignModal, setShowSignModal] = useState(false);
  const [signPaths, setSignPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [signerName, setSignerName] = useState("");

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

  const { unit, readings, findings, diagnosis, actions, photos } = job;
  const notes = job.notes || [];
  const clips = job.clips || [];
  const urgencyColor = getUrgencyColor(diagnosis.urgency);

  const noop = () => {};

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Job Header */}
      <View className="bg-white px-5 pt-5 pb-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-xl font-bold text-slate-900">
              {job.customer_name}
            </Text>
            <View className="flex-row items-center mt-1">
              <FontAwesome name="map-marker" size={12} color="#94A3B8" />
              <Text
                className="text-sm text-slate-500 ml-1.5"
                numberOfLines={1}
              >
                {job.customer_address}
              </Text>
            </View>
          </View>
          {job.status === "in_progress" ? (
            <View className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
              <Text className="text-xs font-bold text-blue-600">
                IN PROGRESS
              </Text>
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
              <Text className="text-xs text-green-600 ml-1.5 font-bold">
                Jobber
              </Text>
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
          onPress={noop}
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
              <Text className="text-white font-bold text-sm">
                View Job Story
              </Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                {job.story.segments.length} key moments · AI summary
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#64748B" />
          </View>
        </Pressable>
      )}

      {/* Automate Button */}
      <Pressable
        onPress={noop}
        className="mx-4 mt-3 rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#1E3A5F",
          shadowColor: "#1E3A5F",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <View className="flex-row items-center px-5 py-4">
          <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center mr-3">
            <FontAwesome name="bolt" size={16} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-sm">Automate</Text>
            <Text className="text-xs mt-0.5" style={{ color: "#BFDBFE" }}>
              Trigger reports & invoices when job completes
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color="#BFDBFE" />
        </View>
      </Pressable>

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
                  status={getReadingStatus(
                    readings.static_pressure_in_wc,
                    0.2,
                    0.5
                  )}
                  target="0.2-0.5"
                />
                <View className="flex-1" />
              </View>
            )}
          </Card>
        </>
      )}

      {/* Unit Info */}
      <SectionHeader title="Unit Info" icon="hdd-o" />
      <Pressable onPress={noop}>
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
              <Text
                className="text-sm text-slate-500 mt-0.5 font-mono"
                numberOfLines={1}
              >
                {unit.model_number}
              </Text>
              <View className="flex-row items-center mt-2 flex-wrap gap-1.5">
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">
                    {unit.refrigerant_type}
                  </Text>
                </View>
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">{unit.tonnage}T</Text>
                </View>
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">
                    {unit.system_type}
                  </Text>
                </View>
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-xs text-slate-600">
                    {unit.age_years}yr
                  </Text>
                </View>
              </View>
            </View>
            <View className="w-7 h-7 bg-slate-100 rounded-full items-center justify-center">
              <FontAwesome name="chevron-right" size={10} color="#94A3B8" />
            </View>
          </View>
        </Card>
      </Pressable>

      {/* Notes & Clips Side by Side */}
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
            <Pressable
              onPress={noop}
              className="bg-white rounded-xl p-4"
              style={{
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center mr-3">
                  <FontAwesome name="sticky-note-o" size={14} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">
                    See notes
                  </Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    {notes.length} {notes.length === 1 ? "note" : "notes"}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={11} color="#CBD5E1" />
              </View>
            </Pressable>
          ) : (
            <View className="bg-white rounded-xl p-4 items-center">
              <FontAwesome name="sticky-note-o" size={18} color="#CBD5E1" />
              <Text className="text-xs text-slate-400 mt-1.5">No notes</Text>
            </View>
          )}
          <Pressable
            onPress={() => setShowNoteModal(true)}
            className="mt-2 rounded-xl py-2.5 items-center"
            style={{ backgroundColor: "#0F172A" }}
          >
            <View className="flex-row items-center">
              <FontAwesome name="plus" size={10} color="#fff" />
              <Text className="text-white font-bold text-xs ml-1.5">
                Add Note
              </Text>
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
                onPress={noop}
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
        </View>
      </View>

      {/* AI Findings */}
      {findings.length > 0 && (
        <>
          <SectionHeader title="AI Findings" icon="eye" />
          {findings.map((finding) => (
            <View key={finding.id} className="mb-2">
              <Card>
                <View className="flex-row items-start">
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                    style={{
                      backgroundColor:
                        getSeverityColor(finding.severity) + "12",
                    }}
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
                        style={{
                          backgroundColor:
                            getSeverityColor(finding.severity) + "14",
                        }}
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

      {/* Actions Taken */}
      {actions.length > 0 && (
        <>
          <SectionHeader title="Actions Taken" icon="check-circle" />
          <Card>
            {actions.map((action, i) => (
              <View
                key={action.id}
                className={`flex-row items-start ${
                  i < actions.length - 1
                    ? "mb-4 pb-4 border-b border-slate-100"
                    : ""
                }`}
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

      {/* Service Report */}
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
                <Text className="text-white font-bold text-sm ml-2">Email</Text>
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

      {/* Photos */}
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

      {/* Customer Signature */}
      <SectionHeader title="Customer Signature" icon="pencil-square-o" />
      {job.signature ? (
        <Card>
          <View className="items-center py-2">
            <View
              className="w-full rounded-xl overflow-hidden bg-slate-50"
              style={{ height: 120 }}
            >
              <Svg width="100%" height="100%" viewBox="0 0 340 120">
                {JSON.parse(job.signature.paths).map(
                  (p: string, i: number) => (
                    <Path
                      key={i}
                      d={p}
                      stroke="#0F172A"
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )
                )}
              </Svg>
            </View>
            <View className="flex-row items-center mt-3">
              <FontAwesome name="check-circle" size={12} color="#16A34A" />
              <Text className="text-xs text-slate-500 ml-1.5">
                Signed by {job.signature.signed_by} ·{" "}
                {formatDateTime(job.signature.signed_at)}
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
                <Text className="text-sm font-bold text-slate-600">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText("");
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
                <Text className="text-sm font-bold text-slate-600">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowEmailModal(false);
                  setEmailTo("");
                }}
                className="flex-1 py-4 rounded-2xl items-center"
                style={{ backgroundColor: "#2563EB" }}
              >
                <View className="flex-row items-center">
                  <FontAwesome name="send" size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white ml-1.5">
                    Send
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Signature Modal */}
      <Modal visible={showSignModal} animationType="slide" transparent>
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <Pressable
            className="flex-1"
            onPress={() => setShowSignModal(false)}
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
              Customer Signature
            </Text>
            <Text className="text-sm text-slate-400 mb-4">
              Please sign below to confirm the work has been completed.
            </Text>

            <TextInput
              value={signerName}
              onChangeText={setSignerName}
              placeholder="Customer name"
              placeholderTextColor="#94A3B8"
              className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-900 mb-4"
            />

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
                <Text className="text-sm font-bold text-slate-600">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
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
