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

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case "emergency":
      return "#DC2626";
    case "urgent":
      return "#EA580C";
    case "routine":
      return "#16A34A";
    default:
      return "#6B7280";
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const urgencyColor = getUrgencyColor(job.diagnosis.urgency);

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
      className="bg-white mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Accent top border */}
      <View style={{ height: 3, backgroundColor: urgencyColor }} />

      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
              {job.customer_name}
            </Text>
            <Text className="text-sm text-slate-500 mt-0.5" numberOfLines={1}>
              {job.customer_address}
            </Text>
          </View>
          {job.status === "in_progress" ? (
            <View className="flex-row items-center bg-blue-50 px-2.5 py-1 rounded-full">
              <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
              <Text className="text-xs font-bold text-blue-600">LIVE</Text>
            </View>
          ) : (
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: urgencyColor + "14" }}
            >
              <Text
                className="text-xs font-bold capitalize"
                style={{ color: urgencyColor }}
              >
                {job.diagnosis.urgency}
              </Text>
            </View>
          )}
        </View>

        {/* Unit tags */}
        <View className="flex-row items-center mt-3 flex-wrap gap-1.5">
          {job.source === "jobber" && (
            <View className="bg-green-50 px-2.5 py-1 rounded-lg flex-row items-center">
              <FontAwesome name="calendar-check-o" size={9} color="#16A34A" />
              <Text className="text-xs font-bold text-green-600 ml-1">Jobber</Text>
            </View>
          )}
          {job.unit.brand ? (
            <View className="bg-slate-100 px-2.5 py-1 rounded-lg">
              <Text className="text-xs font-semibold text-slate-700">
                {job.unit.brand}
              </Text>
            </View>
          ) : null}
          <View className="bg-slate-50 px-2 py-1 rounded-lg">
            <Text className="text-xs text-slate-500">
              {job.unit.tonnage}T
            </Text>
          </View>
          <View className="bg-slate-50 px-2 py-1 rounded-lg">
            <Text className="text-xs text-slate-500">
              {job.unit.system_type}
            </Text>
          </View>
          <View className="bg-slate-50 px-2 py-1 rounded-lg">
            <Text className="text-xs text-slate-500">
              {job.unit.refrigerant_type}
            </Text>
          </View>
        </View>

        {/* Diagnosis preview */}
        {job.diagnosis.primary_issue && (
          <View className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5">
            <Text className="text-xs text-slate-600 leading-4" numberOfLines={2}>
              {job.diagnosis.primary_issue}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View className="flex-row items-center mt-3 justify-between">
          <View className="flex-row items-center">
            <FontAwesome name="clock-o" size={11} color="#94A3B8" />
            <Text className="text-xs text-slate-400 ml-1">
              {formatDate(job.created_at)} at {formatTime(job.created_at)}
            </Text>
            {job.duration_minutes > 0 && (
              <Text className="text-xs text-slate-400 ml-2">
                {job.duration_minutes}m
              </Text>
            )}
          </View>
          <View className="w-6 h-6 bg-slate-100 rounded-full items-center justify-center">
            <FontAwesome name="chevron-right" size={10} color="#94A3B8" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function StatCard({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
}) {
  return (
    <View
      className="flex-1 bg-white rounded-2xl py-4 items-center mx-1.5"
      style={{
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center mb-2">
        <FontAwesome name={icon} size={14} color="#475569" />
      </View>
      <Text className="text-2xl font-bold text-slate-900">{value}</Text>
      <Text className="text-xs text-slate-400 mt-0.5">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { jobs, isLoaded } = useJobStore();

  const sortedJobs = [...jobs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const todayJobs = sortedJobs.filter((j) => isToday(j.created_at));
  const earlierJobs = sortedJobs.filter((j) => !isToday(j.created_at));

  const thisWeekCount = sortedJobs.filter((j) => {
    const d = new Date(j.created_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  const thisMonthCount = sortedJobs.filter((j) => {
    const d = new Date(j.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-8">
        <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
          <FontAwesome name="wrench" size={32} color="#CBD5E1" />
        </View>
        <Text className="text-xl font-bold text-slate-300">No Jobs Yet</Text>
        <Text className="text-sm text-slate-400 mt-2 text-center leading-5">
          Go to Settings and tap "Load Sample Data" to get started with demo
          HVAC jobs.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={sortedJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            {/* Stats */}
            <View className="flex-row px-2.5 py-4">
              <StatCard value={thisWeekCount} label="This Week" icon="calendar" />
              <StatCard value={thisMonthCount} label="This Month" icon="bar-chart" />
              <StatCard value={jobs.length} label="All Jobs" icon="briefcase" />
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const isFirstToday = index === 0 && todayJobs.length > 0;
          const isFirstEarlier =
            index === todayJobs.length && earlierJobs.length > 0;

          return (
            <View>
              {isFirstToday && (
                <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mx-5 mb-2 mt-1">
                  Today
                </Text>
              )}
              {isFirstEarlier && (
                <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mx-5 mb-2 mt-5">
                  Earlier
                </Text>
              )}
              <JobCard
                job={item}
                onPress={() => router.push(`/job/${item.id}`)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}
