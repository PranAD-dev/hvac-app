import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  Modal,
  Image,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { useJobStore } from "../../store/jobStore";
import { FontAwesome } from "@expo/vector-icons";
import { Clip } from "../../types";
import { CLIP_VIDEOS, CLIP_THUMBS } from "../../data/clipAssets";

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

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ClipsListScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const { deleteClip } = useJobStore();
  const [playingClip, setPlayingClip] = useState<Clip | null>(null);

  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "#F2F4F7" }}
      >
        <Text className="text-gray-400">Job not found</Text>
      </View>
    );
  }

  const clips = job.clips || [];

  const handleDelete = (clip: Clip) => {
    Alert.alert("Delete Clip", "Remove this clip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteClip(job.id, clip.id),
      },
    ]);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#F2F4F7" }}>
      <FlatList
        data={clips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
        ListEmptyComponent={
          <View className="items-center justify-center pt-24">
            <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-3">
              <FontAwesome name="video-camera" size={24} color="#9CA3AF" />
            </View>
            <Text className="text-base font-semibold text-gray-800">
              No Clips
            </Text>
            <Text className="text-xs text-gray-400 mt-1">
              Record clips from your smart glasses
            </Text>
          </View>
        }
        renderItem={({ item: clip }) => {
          const thumbAsset = CLIP_THUMBS[clip.id];
          const thumbSource = thumbAsset
            ? thumbAsset
            : clip.thumbnail_path
            ? { uri: clip.thumbnail_path }
            : null;
          return (
            <Pressable
              onPress={() => setPlayingClip(clip)}
              onLongPress={() => handleDelete(clip)}
              className="mx-4 mb-2.5"
            >
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
                <View className="bg-gray-800 h-36 items-center justify-center">
                  {thumbSource && (
                    <Image
                      source={thumbSource}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                      }}
                      resizeMode="cover"
                    />
                  )}
                  <View className="w-12 h-12 rounded-full bg-white/30 items-center justify-center">
                    <FontAwesome name="play" size={16} color="#fff" />
                  </View>
                  <View className="absolute bottom-3 right-3 bg-black/60 px-2 py-1 rounded">
                    <Text className="text-xs text-white font-mono">
                      {formatDuration(clip.duration_seconds)}
                    </Text>
                  </View>
                </View>
                <View className="flex-row">
                  <View className="flex-1 p-4">
                    <Text className="text-base font-semibold text-gray-900">
                      {clip.caption || "Untitled clip"}
                    </Text>
                    <View className="flex-row items-center mt-1.5 gap-2">
                      <View className="flex-row items-center">
                        <FontAwesome name="clock-o" size={11} color="#9CA3AF" />
                        <Text className="text-xs text-gray-400 ml-1">
                          {formatDateTime(clip.recorded_at)}
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-400">
                        {clip.recorded_by}
                      </Text>
                    </View>
                  </View>
                  <View className="justify-center pr-4">
                    <FontAwesome name="chevron-right" size={12} color="#D1D5DB" />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Clip Player Modal */}
      <Modal
        visible={playingClip !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPlayingClip(null)}
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" />
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.95)",
            justifyContent: "center",
          }}
        >
          <Pressable
            onPress={() => setPlayingClip(null)}
            style={{
              position: "absolute",
              top: 56,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
            hitSlop={16}
          >
            <FontAwesome name="times" size={18} color="#FFF" />
          </Pressable>
          {playingClip && (
            <>
              <Video
                source={
                  CLIP_VIDEOS[playingClip.id]
                    ? CLIP_VIDEOS[playingClip.id]
                    : { uri: playingClip.file_path }
                }
                style={{ width: "100%", aspectRatio: 16 / 9 }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
              />
              <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 15,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  {playingClip.caption || "Untitled clip"}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  {playingClip.recorded_by} ·{" "}
                  {formatDuration(playingClip.duration_seconds)}
                </Text>
                <Pressable
                  onPress={() => {
                    setPlayingClip(null);
                    router.push(`/job/${job.id}`);
                  }}
                  style={{
                    marginTop: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFFFFF",
                    borderRadius: 14,
                    paddingVertical: 14,
                    gap: 8,
                  }}
                >
                  <FontAwesome name="arrow-right" size={13} color="#0F172A" />
                  <Text
                    style={{
                      color: "#0F172A",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Go to Job Detail
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}
