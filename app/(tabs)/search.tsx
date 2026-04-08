import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SearchScreen() {
  const router = useRouter();
  const { searchJobs } = useJobStore();
  const [query, setQuery] = useState("");

  const results = query.trim() ? searchJobs(query) : [];

  return (
    <View className="flex-1 bg-slate-50">
      {/* Search input */}
      <View className="bg-white px-4 py-3"
        style={{
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center bg-slate-100 rounded-xl px-4 py-3">
          <FontAwesome name="search" size={15} color="#94A3B8" />
          <TextInput
            className="flex-1 ml-2.5 text-base text-slate-900"
            placeholder="Address, model, serial, brand..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} className="p-1">
              <View className="w-5 h-5 bg-slate-300 rounded-full items-center justify-center">
                <FontAwesome name="times" size={10} color="#fff" />
              </View>
            </Pressable>
          )}
        </View>
      </View>

      {!query.trim() ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
            <FontAwesome name="search" size={32} color="#CBD5E1" />
          </View>
          <Text className="text-sm text-slate-400 text-center leading-5">
            Search by customer address, model number, serial number, brand,
            diagnosis, or notes.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
            <FontAwesome name="inbox" size={32} color="#CBD5E1" />
          </View>
          <Text className="text-base font-semibold text-slate-300">
            No results
          </Text>
          <Text className="text-sm text-slate-400 mt-1 text-center">
            Nothing matched "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const urgencyColor = getUrgencyColor(item.diagnosis.urgency);
            const q = query.toLowerCase().trim();
            const matchingNotes = (item.notes || []).filter((n) =>
              n.text.toLowerCase().includes(q)
            );
            return (
              <Pressable
                onPress={() => router.push(`/job/${item.id}`)}
                className="bg-white mx-4 mb-3 rounded-2xl overflow-hidden"
                style={{
                  shadowColor: "#0F172A",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View style={{ height: 2, backgroundColor: urgencyColor }} />
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                        {item.customer_name}
                      </Text>
                      <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                        {item.customer_address}
                      </Text>
                    </View>
                    <View
                      className="px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: urgencyColor + "14" }}
                    >
                      <Text
                        className="text-xs font-bold capitalize"
                        style={{ color: urgencyColor }}
                      >
                        {item.diagnosis.urgency}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mt-2.5 justify-between">
                    <View className="flex-row items-center">
                      <View className="bg-slate-100 px-2 py-0.5 rounded-md mr-1.5">
                        <Text className="text-xs font-medium text-slate-600">
                          {item.unit.brand}
                        </Text>
                      </View>
                      <Text className="text-xs text-slate-400">
                        {formatDate(item.created_at)}
                      </Text>
                    </View>
                    <Text className="text-xs text-slate-500 flex-shrink" numberOfLines={1}>
                      {item.diagnosis.primary_issue}
                    </Text>
                  </View>

                  {matchingNotes.length > 0 && (
                    <View className="mt-2.5 bg-blue-50 rounded-xl px-3 py-2">
                      <View className="flex-row items-center mb-1">
                        <FontAwesome name="sticky-note-o" size={10} color="#2563EB" />
                        <Text className="text-xs font-bold text-blue-600 ml-1.5">
                          {matchingNotes.length} matching {matchingNotes.length === 1 ? "note" : "notes"}
                        </Text>
                      </View>
                      <Text className="text-xs text-blue-500" numberOfLines={1}>
                        {matchingNotes[0].text}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
