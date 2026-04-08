import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Dimensions,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useJobStore } from "../../store/jobStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - CARD_GAP) / 2;
const COMPOSIO_SERVER = "http://10.104.9.16:3001";
const RENTAL_EMAIL = "suppboiiyeet@gmail.com";

const TOOLS = [
  {
    id: "1",
    name: "Manifold Gauge Set",
    description: "Measure high & low side refrigerant pressures",
    image: require("../../assets/tools/manifold-gauge-set.jpeg"),
  },
  {
    id: "2",
    name: "Digital Manifold",
    description: "Smart pressure & temperature diagnostics",
    image: require("../../assets/tools/digital-manifold.png"),
  },
  {
    id: "3",
    name: "Multimeter",
    description: "Measure voltage, current, and resistance",
    image: require("../../assets/tools/multimeter.webp"),
  },
  {
    id: "4",
    name: "Clamp Meter",
    description: "Non-contact amperage readings on wires",
    image: require("../../assets/tools/clampmeter.jpeg"),
  },
  {
    id: "5",
    name: "Thermocouple",
    description: "Measure pipe & air temperature accurately",
    image: require("../../assets/tools/thermocouple.jpg"),
  },
  {
    id: "6",
    name: "Refrigerant Scale",
    description: "Weigh refrigerant charge during service",
    image: require("../../assets/tools/refrigerant-scale.png"),
  },
  {
    id: "7",
    name: "Vacuum Pump",
    description: "Evacuate moisture & air from refrigerant lines",
    image: require("../../assets/tools/vacuum-pump.jpeg"),
  },
  {
    id: "8",
    name: "Recovery Machine",
    description: "Recover refrigerant before system service",
    image: require("../../assets/tools/refrigerant-recovery-machine.jpeg"),
  },
];

type Tool = (typeof TOOLS)[number];

function ToolCard({
  tool,
  onRent,
  renting,
}: {
  tool: Tool;
  onRent: () => void;
  renting: boolean;
}) {
  return (
    <View
      style={{ width: CARD_WIDTH }}
      className="bg-white rounded-2xl overflow-hidden mb-3"
    >
      <View
        style={{ width: CARD_WIDTH, height: CARD_WIDTH * 0.85 }}
        className="bg-slate-100 items-center justify-center"
      >
        <Image
          source={tool.image}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </View>
      <View className="p-3">
        <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
          {tool.name}
        </Text>
        <Text className="text-xs text-slate-400 mt-1 leading-4" numberOfLines={2}>
          {tool.description}
        </Text>
        <Pressable
          onPress={onRent}
          disabled={renting}
          className="mt-2.5 rounded-xl py-2.5 items-center"
          style={{ backgroundColor: renting ? "#86EFAC" : "#16A34A" }}
        >
          {renting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View className="flex-row items-center">
              <FontAwesome name="check-circle" size={13} color="#fff" />
              <Text className="text-xs font-bold text-white ml-1.5">Rent</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function ToolsScreen() {
  const techName = useJobStore((s) => s.techName);
  const [rentingId, setRentingId] = useState<string | null>(null);

  const handleRent = async (tool: Tool) => {
    setRentingId(tool.id);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    try {
      const res = await fetch(`${COMPOSIO_SERVER}/gmail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: RENTAL_EMAIL,
          subject: `Tool Rental Request — ${tool.name}`,
          body: `TOOL RENTAL REQUEST\n\nTool: ${tool.name}\nRequested by: ${techName}\nDate: ${dateStr}\nTime: ${timeStr}\n\nPlease confirm availability and reserve this tool.\n\n— Sent from HVAC Companion`,
        }),
      });
      const result = await res.json();
      setRentingId(null);

      if (result.success) {
        Alert.alert(
          "Request Sent!",
          `Rental request for ${tool.name} has been emailed.`
        );
      } else {
        Alert.alert("Failed", result.error || "Could not send request.");
      }
    } catch {
      setRentingId(null);
      Alert.alert(
        "Server Not Running",
        "Start the Composio server first:\ncd server && node index.js"
      );
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Header */}
      <View className="px-5 pt-5 pb-2">
        <View className="flex-row items-center mb-1">
          <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
            <FontAwesome name="wrench" size={18} color="#2563EB" />
          </View>
          <View>
            <Text className="text-lg font-bold text-slate-900">
              Company Tools
            </Text>
            <Text className="text-xs text-slate-400">
              {TOOLS.length} tools available
            </Text>
          </View>
        </View>
      </View>

      {/* Grid */}
      <View className="px-4 pt-3">
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: CARD_GAP,
          }}
        >
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onRent={() => handleRent(tool)}
              renting={rentingId === tool.id}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
