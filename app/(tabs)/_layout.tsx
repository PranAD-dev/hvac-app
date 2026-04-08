import React from "react";
import { Text, View, Platform, Pressable } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

function HeaderLeft() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/tools")}
      className="flex-row items-center ml-4 bg-white/15 px-3 py-1.5 rounded-full"
    >
      <FontAwesome name="th-large" size={12} color="#fff" />
      <Text className="text-white text-xs ml-1.5 font-medium">Tools</Text>
    </Pressable>
  );
}

function HeaderRight() {
  const techName = useJobStore((s) => s.techName);
  return (
    <View className="flex-row items-center mr-4 bg-white/15 px-3 py-1.5 rounded-full">
      <View className="w-5 h-5 rounded-full bg-white/25 items-center justify-center">
        <FontAwesome name="user" size={10} color="#fff" />
      </View>
      <Text className="text-white text-xs ml-1.5 font-medium">{techName}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0F172A",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 8,
        },
        headerStyle: {
          backgroundColor: "#0F172A",
          shadowColor: "transparent",
          elevation: 0,
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 17,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "HVAC Companion",
          tabBarLabel: "Jobs",
          tabBarIcon: ({ color }) => <TabBarIcon name="wrench" color={color} />,
          headerLeft: () => <HeaderLeft />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Notes & Clips",
          tabBarLabel: "Notes",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="sticky-note-o" color={color} />
          ),
          headerRight: () => <HeaderRight />,
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: "Ask",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="comments" color={color} />
          ),
          headerRight: () => <HeaderRight />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
