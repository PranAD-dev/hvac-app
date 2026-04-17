import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";
import { Job } from "../../types";
import { FontAwesome } from "@expo/vector-icons";

const URGENCY = {
  emergency: { color: "#DC2626", bg: "#FFFFFF", label: "Emergency" },
  urgent: { color: "#F59E0B", bg: "#FFFFFF", label: "Urgent" },
  routine: { color: "#22C55E", bg: "#FFFFFF", label: "Routine" },
  default: { color: "#9CA3AF", bg: "#FFFFFF", label: "—" },
} as const;

function urgency(u: string) {
  return URGENCY[u as keyof typeof URGENCY] || URGENCY.default;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/* ── Hero card for the latest job ─────────────────────────────── */

function NextUpCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const u = urgency(job.diagnosis.urgency);
  return (
    <Pressable onPress={onPress} className="mx-4 mt-4 mb-2">
      <View
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#1E3A5F",
          shadowColor: "#1E3A5F",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 14,
          elevation: 8,
        }}
      >
        <View className="p-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold tracking-wider" style={{ color: "#93C5FD", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Latest Job
            </Text>
            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: u.color + "30" }}>
              <Text className="text-xs font-bold" style={{ color: u.color }}>{u.label}</Text>
            </View>
          </View>

          <Text className="text-xl font-bold text-white">{job.customer_name}</Text>

          <View className="flex-row items-center mt-1.5">
            <FontAwesome name="map-marker" size={13} color="#93C5FD" />
            <Text className="text-sm ml-1.5" style={{ color: "#BFDBFE" }} numberOfLines={1}>
              {job.customer_address}
            </Text>
          </View>

          {job.diagnosis.primary_issue && (
            <Text className="text-sm mt-3" style={{ color: "#CBD5E1" }} numberOfLines={2}>
              {job.diagnosis.primary_issue}
            </Text>
          )}

          <View className="flex-row items-center mt-4 justify-between">
            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center">
                <FontAwesome name="calendar" size={12} color="#93C5FD" />
                <Text className="text-xs font-medium ml-1.5" style={{ color: "#93C5FD" }}>
                  {fmtDate(job.created_at)}
                </Text>
              </View>
              <View className="flex-row items-center">
                <FontAwesome name="clock-o" size={12} color="#93C5FD" />
                <Text className="text-xs font-medium ml-1" style={{ color: "#93C5FD" }}>
                  {fmtTime(job.created_at)}
                </Text>
              </View>
              {job.unit.brand && (
                <Text className="text-xs font-medium" style={{ color: "#93C5FD" }}>
                  {job.unit.brand} · {job.unit.tonnage}T
                </Text>
              )}
            </View>
            <View className="bg-white rounded-full w-8 h-8 items-center justify-center">
              <FontAwesome name="arrow-right" size={13} color="#1E3A5F" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ── Standard job card ────────────────────────────────────────── */

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const u = urgency(job.diagnosis.urgency);

  const handleLongPress = async () => {
    if (!job.service_report) return;
    try {
      await Share.share({
        message: `Service Report\n${job.customer_name} — ${job.customer_address}\n\n${job.service_report}`,
      });
    } catch {}
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      className="mx-4 mb-2.5"
    >
      <View
        className="bg-white rounded-xl overflow-hidden flex-row"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <View className="flex-1 p-4">
          {/* Row 1 */}
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 flex-1 mr-3" numberOfLines={1}>
              {job.customer_name}
            </Text>
            <Text className="text-xs text-gray-400">{fmtTime(job.created_at)}</Text>
          </View>

          {/* Row 2: Address */}
          <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
            {job.customer_address}
          </Text>

          {/* Row 3: Tags */}
          <View className="flex-row items-center mt-2.5 gap-2">
            <View className="px-2 py-0.5 rounded" style={{ backgroundColor: u.bg }}>
              <Text className="text-xs font-semibold" style={{ color: u.color }}>{u.label}</Text>
            </View>
            {job.unit.brand && (
              <View className="bg-gray-100 px-2 py-0.5 rounded">
                <Text className="text-xs text-gray-600">{job.unit.brand}</Text>
              </View>
            )}
            <Text className="text-xs text-gray-400">{job.unit.tonnage}T · {job.unit.refrigerant_type}</Text>
            {job.source === "jobber" && (
              <View className="bg-green-50 px-2 py-0.5 rounded">
                <Text className="text-xs font-medium text-green-600">Jobber</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <View className="justify-center pr-4">
          <FontAwesome name="chevron-right" size={12} color="#D1D5DB" />
        </View>
      </View>
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────── */

export default function JobsScreen() {
  const router = useRouter();
  const { jobs, isLoaded } = useJobStore();

  const sorted = [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const todayJobs = sorted.filter((j) => isToday(j.created_at));
  const restJobs = sorted.slice(1);

  const thisWeek = sorted.filter((j) => {
    const d = new Date(j.created_at);
    return d >= new Date(Date.now() - 7 * 86400000);
  }).length;

  const thisMonth = sorted.filter((j) => {
    const d = new Date(j.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#F2F4F7" }}>
        <ActivityIndicator size="large" color="#1E3A5F" />
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: "#F2F4F7" }}>
        <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-4">
          <FontAwesome name="wrench" size={24} color="#9CA3AF" />
        </View>
        <Text className="text-lg font-semibold text-gray-800">No Jobs Yet</Text>
        <Text className="text-sm text-gray-400 mt-1 text-center">
          Head to Settings and load sample data to get started.
        </Text>
      </View>
    );
  }

  const heroJob = sorted[0];

  return (
    <View className="flex-1" style={{ backgroundColor: "#F2F4F7" }}>
      <FlatList
        data={restJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <NextUpCard job={heroJob} onPress={() => router.push(`/job/${heroJob.id}`)} />

            {/* Stats row */}
            <View className="flex-row items-center mx-5 mt-4 mb-1 gap-4">
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                <Text className="text-sm font-medium text-gray-700">{todayJobs.length} today</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-gray-300 mr-1.5" />
                <Text className="text-sm font-medium text-gray-700">{thisWeek} this week</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-gray-300 mr-1.5" />
                <Text className="text-sm font-medium text-gray-700">{thisMonth} this month</Text>
              </View>
            </View>

            {/* Section label */}
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 mx-5 mt-4 mb-2">
              All Jobs
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />
        )}
      />
    </View>
  );
}
