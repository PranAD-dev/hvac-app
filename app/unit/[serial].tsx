import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";
import { FontAwesome } from "@expo/vector-icons";

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case "emergency":
      return "#EF4444";
    case "urgent":
      return "#F97316";
    default:
      return "#22C55E";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UnitHistoryScreen() {
  const { serial } = useLocalSearchParams<{ serial: string }>();
  const router = useRouter();
  const getJobsBySerialNumber = useJobStore((s) => s.getJobsBySerialNumber);

  const unitJobs = getJobsBySerialNumber(serial);

  if (unitJobs.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <FontAwesome name="inbox" size={48} color="#D1D5DB" />
        <Text className="text-gray-400 mt-4">No history for this unit</Text>
      </View>
    );
  }

  const unit = unitJobs[0].unit;

  // Calculate lifetime stats
  const totalRefrigerant = unitJobs.reduce((sum, j) => {
    return (
      sum +
      j.actions
        .filter((a) => a.type === "refrigerant_added")
        .reduce((s, a) => s + a.quantity, 0)
    );
  }, 0);

  const issueCount: Record<string, number> = {};
  unitJobs.forEach((j) => {
    const issue = j.diagnosis.primary_issue;
    issueCount[issue] = (issueCount[issue] || 0) + 1;
  });
  const mostCommonIssue = Object.entries(issueCount).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];

  // Superheat trend
  const superheatData = unitJobs
    .filter((j) => j.readings.superheat_f > 0)
    .reverse()
    .map((j) => ({
      date: formatDate(j.created_at),
      value: j.readings.superheat_f,
    }));

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Unit Identity Card */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
          elevation: 1,
        }}
      >
        <View className="flex-row items-start">
          <View className="w-14 h-14 bg-blue-50 rounded-lg items-center justify-center mr-3">
            <FontAwesome name="hdd-o" size={22} color="#1E3A5F" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">
              {unit.brand}
            </Text>
            <Text className="text-sm text-gray-600">{unit.model_number}</Text>
            <Text className="text-xs text-gray-400 mt-1">
              {unit.refrigerant_type}  {unit.tonnage}T  {unit.system_type}
            </Text>
            <Text className="text-xs text-gray-400">
              Serial: {unit.serial_number}  Age: {unit.age_years} yrs
            </Text>
          </View>
        </View>
      </View>

      {/* Lifetime Stats */}
      <View className="flex-row mx-4 mt-4">
        <View className="flex-1 bg-white rounded-xl p-3 mr-2 items-center"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Text className="text-xl font-bold text-gray-900">
            {unitJobs.length}
          </Text>
          <Text className="text-xs text-gray-500">Total Jobs</Text>
        </View>
        <View className="flex-1 bg-white rounded-xl p-3 mr-2 items-center"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Text className="text-xl font-bold text-gray-900">
            {totalRefrigerant > 0 ? `${totalRefrigerant.toFixed(1)}` : "0"}
          </Text>
          <Text className="text-xs text-gray-500">lbs Refrigerant</Text>
        </View>
        <View className="flex-1 bg-white rounded-xl p-3 items-center"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Text className="text-xl font-bold text-gray-900">
            {unitJobs.filter((j) => j.diagnosis.urgency !== "routine").length}
          </Text>
          <Text className="text-xs text-gray-500">Issues</Text>
        </View>
      </View>

      {mostCommonIssue && (
        <View className="bg-white mx-4 mt-3 rounded-xl p-3"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Text className="text-xs text-gray-400">Most Common Issue</Text>
          <Text className="text-sm font-medium text-gray-700 mt-0.5">
            {mostCommonIssue}
          </Text>
        </View>
      )}

      {/* Superheat Trend (text-based) */}
      {superheatData.length > 1 && (
        <>
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mx-4 mt-6 mb-3">
            Superheat Trend
          </Text>
          <View className="bg-white mx-4 rounded-xl p-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            {superheatData.map((entry, i) => {
              const barWidth = Math.min(
                Math.max((entry.value / 30) * 100, 10),
                100
              );
              const isHigh = entry.value > 15;
              const isLow = entry.value < 10;
              const barColor = isHigh
                ? "#F97316"
                : isLow
                  ? "#3B82F6"
                  : "#22C55E";

              return (
                <View key={i} className="flex-row items-center mb-2">
                  <Text className="text-xs text-gray-400 w-20">
                    {entry.date}
                  </Text>
                  <View className="flex-1 mx-2 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </View>
                  <Text className="text-xs font-semibold text-gray-700 w-10 text-right">
                    {entry.value}°F
                  </Text>
                </View>
              );
            })}
            <View className="flex-row items-center mt-2 pt-2 border-t border-gray-100">
              <View className="flex-row items-center mr-4">
                <View className="w-3 h-3 rounded-full bg-green-500 mr-1" />
                <Text className="text-xs text-gray-400">Normal (10-15)</Text>
              </View>
              <View className="flex-row items-center mr-4">
                <View className="w-3 h-3 rounded-full bg-orange-500 mr-1" />
                <Text className="text-xs text-gray-400">High</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-blue-500 mr-1" />
                <Text className="text-xs text-gray-400">Low</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Job Timeline */}
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mx-4 mt-6 mb-3">
        Service History
      </Text>
      {unitJobs.map((job, i) => (
        <Pressable
          key={job.id}
          onPress={() => router.push(`/job/${job.id}`)}
          className="mx-4 mb-3"
        >
          <View
            className="bg-white rounded-xl p-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-semibold text-gray-900">
                  {job.diagnosis.primary_issue}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  {formatDate(job.created_at)}  {job.duration_minutes} min
                </Text>
              </View>
              <View
                className="px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor:
                    getUrgencyColor(job.diagnosis.urgency) + "20",
                }}
              >
                <Text
                  className="text-xs font-medium capitalize"
                  style={{
                    color: getUrgencyColor(job.diagnosis.urgency),
                  }}
                >
                  {job.diagnosis.urgency}
                </Text>
              </View>
            </View>

            {job.actions.length > 0 && (
              <View className="mt-2 pt-2 border-t border-gray-100">
                {job.actions.slice(0, 3).map((action) => (
                  <View
                    key={action.id}
                    className="flex-row items-center mt-1"
                  >
                    <FontAwesome
                      name="check"
                      size={10}
                      color="#22C55E"
                    />
                    <Text
                      className="text-xs text-gray-600 ml-2 flex-1"
                      numberOfLines={1}
                    >
                      {action.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
