import React, { useState } from "react";
import { Text, View, Platform, Pressable, Modal } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Drawer } from "expo-router/drawer";
import { useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";
import { BlurView } from "expo-blur";

const NOTIFICATIONS = [
  {
    id: "1",
    icon: "plus-circle" as const,
    iconBg: "#2563EB",
    title: "New job assigned",
    body: "Emergency AC repair — Sarah Chen",
    time: "2h ago",
    unread: true,
    route: "/job/job-002" as string | null,
  },
  {
    id: "2",
    icon: "calendar" as const,
    iconBg: "#0D9488",
    title: "Job scheduled",
    body: "Annual maintenance — Robert Martinez",
    time: "5h ago",
    unread: true,
    route: "/job/job-003" as string | null,
  },
  {
    id: "3",
    icon: "wrench" as const,
    iconBg: "#EA580C",
    title: "Tech dispatched",
    body: "Thermostat replacement — John Smith",
    time: "1d ago",
    unread: false,
    route: "/job/job-001" as string | null,
  },
  {
    id: "4",
    icon: "eye" as const,
    iconBg: "#7C3AED",
    title: "Invoice #1047 viewed",
    body: "Customer opened your invoice",
    time: "2d ago",
    unread: false,
    route: null as string | null,
  },
];

const DRAWER_ITEMS: { name: string; label: string; icon: React.ComponentProps<typeof FontAwesome>["name"] }[] = [
  { name: "index", label: "Home", icon: "home" },
  { name: "jobs", label: "Jobs", icon: "wrench" },
  { name: "live", label: "Notes & Clips", icon: "sticky-note-o" },
  { name: "ask", label: "Ask AI", icon: "comments" },
  { name: "tools", label: "Tools", icon: "briefcase" },
  { name: "settings", label: "Settings", icon: "cog" },
];

function HeaderRight() {
  const router = useRouter();
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <View className="mr-4">
      <Pressable
        onPress={() => setShowNotifs(true)}
        className="w-9 h-9 rounded-full bg-white/15 items-center justify-center"
      >
        <FontAwesome name="bell" size={15} color="#fff" />
        {unreadCount > 0 && (
          <View
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full items-center justify-center"
            style={{ backgroundColor: "#DC2626" }}
          >
            <Text className="text-white text-xs font-bold" style={{ fontSize: 9 }}>
              {unreadCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal visible={showNotifs} transparent animationType="fade">
        <Pressable className="flex-1" onPress={() => setShowNotifs(false)}>
          <View
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 100 : 56,
              right: 16,
              width: 300,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <BlurView intensity={80} tint="dark" style={{ backgroundColor: "rgba(15,23,42,0.7)" }}>
              <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
                <Text className="text-sm font-bold text-white">Notifications</Text>
                {unreadCount > 0 && (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(37,99,235,0.3)", borderWidth: 1, borderColor: "rgba(37,99,235,0.5)" }}>
                    <Text className="text-xs font-bold" style={{ color: "#93c5fd" }}>{unreadCount} new</Text>
                  </View>
                )}
              </View>

              {NOTIFICATIONS.map((notif) => {
                const content = (
                  <>
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
                      style={{ backgroundColor: notif.iconBg + "30" }}
                    >
                      <FontAwesome name={notif.icon} size={13} color={notif.iconBg} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-white">{notif.title}</Text>
                      <Text className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{notif.body}</Text>
                      <Text className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{notif.time}</Text>
                    </View>
                    {notif.unread && (
                      <View className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: "#60a5fa" }} />
                    )}
                  </>
                );

                const rowStyle = {
                  backgroundColor: notif.unread ? "rgba(37,99,235,0.1)" : "transparent",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.06)",
                  opacity: notif.route ? 1 : 0.75,
                };

                if (!notif.route) {
                  return (
                    <View
                      key={notif.id}
                      className="flex-row items-start px-4 py-3"
                      style={rowStyle}
                    >
                      {content}
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={notif.id}
                    className="flex-row items-start px-4 py-3"
                    style={rowStyle}
                    onPress={() => {
                      setShowNotifs(false);
                      router.push(notif.route as any);
                    }}
                  >
                    {content}
                  </Pressable>
                );
              })}
            </BlurView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function DrawerLayout() {
  const techName = useJobStore((s) => s.techName);

  return (
    <Drawer
      screenOptions={{
        headerStyle: {
          backgroundColor: "#1E3A5F",
          shadowColor: "transparent",
          elevation: 0,
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 17,
        },
        headerRight: () => <HeaderRight />,
        drawerStyle: {
          backgroundColor: "#0F172A",
          width: 280,
        },
        drawerActiveTintColor: "#60A5FA",
        drawerInactiveTintColor: "#94A3B8",
        drawerActiveBackgroundColor: "rgba(96,165,250,0.1)",
        drawerLabelStyle: {
          fontSize: 15,
          fontWeight: "600",
          marginLeft: -8,
        },
        drawerItemStyle: {
          borderRadius: 12,
          marginHorizontal: 12,
          paddingVertical: 2,
        },
      }}
    >
      {DRAWER_ITEMS.map((item) => (
        <Drawer.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.name === "index" ? "Home" : item.label,
            drawerLabel: item.label,
            drawerIcon: ({ color }) => (
              <FontAwesome name={item.icon} size={20} color={color} />
            ),
            ...(item.name === "index" && {
              headerStyle: {
                backgroundColor: "#1E3A5F",
                shadowColor: "transparent",
                elevation: 0,
              },
              headerTintColor: "#fff",
              headerTitleStyle: { fontWeight: "700", fontSize: 17, color: "#fff" },
            }),
          }}
        />
      ))}
    </Drawer>
  );
}
