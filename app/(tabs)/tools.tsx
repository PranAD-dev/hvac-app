import React, { useState } from "react";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

interface Tool {
  id: string;
  name: string;
  category: string;
  description: string;
  image: any;
}

const TOOLS: Tool[] = [
  {
    id: "1",
    name: "Digital Manifold",
    category: "Diagnostics",
    description: "Measure pressure, temperature, superheat & subcooling digitally.",
    image: require("../../assets/tools/digital-manifold.png"),
  },
  {
    id: "2",
    name: "Manifold Gauge Set",
    category: "Diagnostics",
    description: "Analog high/low side pressure gauges with hose connections.",
    image: require("../../assets/tools/manifold-gauge-set.jpeg"),
  },
  {
    id: "3",
    name: "Clamp Meter",
    category: "Electrical",
    description: "Measure amperage, voltage, and resistance without breaking the circuit.",
    image: require("../../assets/tools/clampmeter.jpeg"),
  },
  {
    id: "4",
    name: "Multimeter",
    category: "Electrical",
    description: "Test voltage, current, continuity, and capacitance on components.",
    image: require("../../assets/tools/multimeter.webp"),
  },
  {
    id: "5",
    name: "Thermocouple",
    category: "Temperature",
    description: "Precise temperature readings on supply/return lines and coils.",
    image: require("../../assets/tools/thermocouple.jpg"),
  },
  {
    id: "6",
    name: "Refrigerant Scale",
    category: "Refrigerant",
    description: "Weigh refrigerant charge accurately during recovery and charging.",
    image: require("../../assets/tools/refrigerant-scale.png"),
  },
  {
    id: "7",
    name: "Recovery Machine",
    category: "Refrigerant",
    description: "Recover refrigerant from systems before repairs per EPA regulations.",
    image: require("../../assets/tools/refrigerant-recovery-machine.jpeg"),
  },
  {
    id: "8",
    name: "Vacuum Pump",
    category: "Service",
    description: "Evacuate moisture and air from the system before charging.",
    image: require("../../assets/tools/vacuum-pump.jpeg"),
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(TOOLS.map((t) => t.category)))];

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <View className="mx-4 mb-2.5">
      <View
        className="bg-white rounded-xl overflow-hidden"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Image
          source={tool.image}
          style={{ width: "100%", height: 140, backgroundColor: "#F3F4F6" }}
          resizeMode="cover"
        />
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-base font-semibold text-gray-900">
              {tool.name}
            </Text>
            <View className="px-2 py-0.5 rounded" style={{ backgroundColor: "#EFF6FF" }}>
              <Text className="text-xs font-semibold" style={{ color: "#2563EB" }}>
                {tool.category}
              </Text>
            </View>
          </View>
          <Text className="text-sm text-gray-500" numberOfLines={2}>
            {tool.description}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ToolsScreen() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? TOOLS
      : TOOLS.filter((t) => t.category === activeCategory);

  return (
    <View className="flex-1" style={{ backgroundColor: "#F2F4F7" }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Stats row */}
            <View className="flex-row items-center mx-5 mt-4 mb-1 gap-4">
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                <Text className="text-sm font-medium text-gray-700">{TOOLS.length} tools</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-gray-300 mr-1.5" />
                <Text className="text-sm font-medium text-gray-700">{CATEGORIES.length - 1} categories</Text>
              </View>
            </View>

            {/* Category filter pills */}
            <FlatList
              horizontal
              data={CATEGORIES}
              keyExtractor={(c) => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}
              renderItem={({ item: cat }) => (
                <Pressable
                  onPress={() => setActiveCategory(cat)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: activeCategory === cat ? "#1E3A5F" : "#fff",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: activeCategory === cat ? 0 : 0.06,
                    shadowRadius: 2,
                    elevation: activeCategory === cat ? 0 : 1,
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{
                      color: activeCategory === cat ? "#fff" : "#6B7280",
                    }}
                  >
                    {cat}
                  </Text>
                </Pressable>
              )}
            />

            {/* Section label */}
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 mx-5 mt-2 mb-2">
              {activeCategory === "All" ? "All Tools" : activeCategory}
            </Text>
          </View>
        }
        renderItem={({ item }) => <ToolCard tool={item} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pt-16">
            <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-4">
              <FontAwesome name="briefcase" size={24} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-semibold text-gray-800">No Tools Found</Text>
          </View>
        }
      />
    </View>
  );
}
