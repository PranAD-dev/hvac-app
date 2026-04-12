import React, { Suspense, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { useJobStore } from "../../store/jobStore";
import GlassesViewer from "../../components/GlassesViewer";

/* ── Clips grid item ─────────────────────────────────────────── */

function ClipThumb({
  caption,
  duration,
  onPress,
}: {
  caption: string;
  duration: number;
  onPress: () => void;
}) {
  const fmt =
    Math.floor(duration / 60) + ":" + (duration % 60).toString().padStart(2, "0");
  return (
    <Pressable onPress={onPress} style={{ flex: 1, aspectRatio: 1 }}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#E5E7EB",
          borderRadius: 8,
          overflow: "hidden",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <FontAwesome name="video-camera" size={20} color="#9CA3AF" />
        <Text
          style={{ color: "#6B7280", fontSize: 10, marginTop: 6 }}
          numberOfLines={1}
        >
          {caption}
        </Text>
        {duration > 0 && (
          <View
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 3,
              paddingHorizontal: 4,
              paddingVertical: 1,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "500" }}>
              {fmt}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/* ── Screen ───────────────────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const [isPaused, setIsPaused] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSettings = () => {
    router.push("/(tabs)/settings");
  };

  const handleUpdate = () => {
    Alert.alert(
      "Firmware Update",
      "Vuzix Blade firmware v2.4.1 is available. Update now?",
      [
        { text: "Later", style: "cancel" },
        {
          text: "Update",
          onPress: () => {
            setIsUpdating(true);
            setTimeout(() => {
              setIsUpdating(false);
              Alert.alert("Updated", "Firmware updated to v2.4.1 successfully.");
            }, 2500);
          },
        },
      ]
    );
  };

  const handlePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        Alert.alert("Paused", "Glasses recording and streaming paused.");
      } else {
        Alert.alert("Resumed", "Glasses recording and streaming resumed.");
      }
      return next;
    });
  };

  const handleTranslate = () => {
    const languages = ["Spanish", "French", "German", "Chinese", "Japanese", "Portuguese"];
    Alert.alert(
      "Live Translate",
      "Select target language for real-time translation:",
      [
        ...languages.map((lang) => ({
          text: lang,
          onPress: () => Alert.alert("Translation Active", `Translating to ${lang}. Speak normally — translations will appear on your glasses display.`),
        })),
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const allClips = useMemo(() => {
    const clips: { jobId: string; clip: any }[] = [];
    for (const job of jobs) {
      for (const clip of job.clips || []) {
        clips.push({ jobId: job.id, clip });
      }
    }
    clips.sort(
      (a, b) =>
        new Date(b.clip.recorded_at).getTime() -
        new Date(a.clip.recorded_at).getTime()
    );
    return clips;
  }, [jobs]);

  const previewClips = allClips.slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F4F7" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Device Card ────────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 24,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {/* Top row: brand + settings */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                style={{
                  color: "#111827",
                  fontSize: 15,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                Vuzix
              </Text>
              <View
                style={{
                  width: 1,
                  height: 14,
                  backgroundColor: "#D1D5DB",
                }}
              />
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: 11,
                  fontWeight: "500",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Blade
              </Text>
            </View>
            <Pressable
              onPress={handleSettings}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesome name="cog" size={18} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Device name */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#111827", fontSize: 22, fontWeight: "600" }}>
              Tech's Glasses
            </Text>
            <FontAwesome name="pencil" size={11} color="#D1D5DB" />
          </View>

          {/* Battery */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginTop: 4,
            }}
          >
            <FontAwesome name="battery-full" size={13} color="#22C55E" />
            <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "500" }}>
              100%
            </Text>
          </View>

          {/* 3D Model */}
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Suspense
              fallback={
                <View style={{ width: 220, height: 220, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color="#1E3A5F" />
                </View>
              }
            >
              <GlassesViewer size={220} />
            </Suspense>
          </View>
        </View>

        {/* ── Action Buttons ─────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 16,
            gap: 10,
          }}
        >
          <Pressable
            onPress={handleUpdate}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#1E3A5F",
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 16,
            }}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome name="download" size={16} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
              {isUpdating ? "Updating..." : "Update available"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handlePause}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: isPaused ? "#FEF2F2" : "#fff",
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <FontAwesome name={isPaused ? "play" : "moon-o"} size={16} color={isPaused ? "#DC2626" : "#6B7280"} />
            <Text style={{ color: isPaused ? "#DC2626" : "#6B7280", fontSize: 14, fontWeight: "600" }}>
              {isPaused ? "Resume" : "Pause"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleTranslate}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#fff",
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <FontAwesome name="language" size={16} color="#6B7280" />
            <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600" }}>
              Translate
            </Text>
          </Pressable>
        </ScrollView>

        {/* ── Divider ────────────────────────────────────────── */}
        <View
          style={{
            height: 1,
            backgroundColor: "#E5E7EB",
            marginHorizontal: 20,
            marginBottom: 24,
          }}
        />

        {/* ── Clips Section ──────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#111827", fontSize: 20, fontWeight: "600" }}>
              Clips
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/live")}>
              <Text style={{ color: "#1E3A5F", fontSize: 14, fontWeight: "500" }}>
                See all
              </Text>
            </Pressable>
          </View>

          {previewClips.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 2,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {previewClips.map(({ jobId, clip }, i) => (
                <View key={clip.id || i} style={{ width: "24.5%", aspectRatio: 1 }}>
                  <ClipThumb
                    caption={clip.caption}
                    duration={clip.duration_seconds}
                    onPress={() => router.push(`/job/${jobId}`)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 32,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <FontAwesome name="video-camera" size={28} color="#D1D5DB" />
              <Text
                style={{
                  color: "#6B7280",
                  fontSize: 14,
                  fontWeight: "500",
                  marginTop: 12,
                }}
              >
                No clips yet
              </Text>
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: 12,
                  marginTop: 4,
                  textAlign: "center",
                }}
              >
                Clips recorded from your glasses will appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
