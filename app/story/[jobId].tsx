import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";
import { FontAwesome } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { StorySegment } from "../../types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getTagColor(tag: StorySegment["tag"]) {
  switch (tag) {
    case "travel":
      return "#6366F1";
    case "inspection":
      return "#2563EB";
    case "diagnostic":
      return "#EA580C";
    case "repair":
      return "#16A34A";
    case "customer":
      return "#7C3AED";
    case "complete":
      return "#059669";
    default:
      return "#64748B";
  }
}

function getTagIcon(tag: StorySegment["tag"]): React.ComponentProps<typeof FontAwesome>["name"] {
  switch (tag) {
    case "travel":
      return "car";
    case "inspection":
      return "search";
    case "diagnostic":
      return "dashboard";
    case "repair":
      return "wrench";
    case "customer":
      return "user";
    case "complete":
      return "check-circle";
    default:
      return "circle";
  }
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Thumbnail mapping for the demo video frames
const STORY_THUMBNAILS: Record<string, any> = {
  "assets/story/frame_01.jpg": require("../../assets/story/frame_01.jpg"),
  "assets/story/frame_02.jpg": require("../../assets/story/frame_02.jpg"),
  "assets/story/frame_03.jpg": require("../../assets/story/frame_03.jpg"),
  "assets/story/frame_04.jpg": require("../../assets/story/frame_04.jpg"),
  "assets/story/frame_05.jpg": require("../../assets/story/frame_05.jpg"),
  "assets/story/frame_06.jpg": require("../../assets/story/frame_06.jpg"),
  "assets/story/frame_07.jpg": require("../../assets/story/frame_07.jpg"),
};

export default function StoryScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const job = jobs.find((j) => j.id === jobId);
  const [activeSegment, setActiveSegment] = useState(0);
  const [playingSegment, setPlayingSegment] = useState<StorySegment | null>(null);
  const videoRef = useRef<Video>(null);
  const playbackEndRef = useRef<number>(0);

  if (!job || !job.story) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <FontAwesome name="film" size={32} color="#CBD5E1" />
        <Text className="text-slate-400 mt-3">No story available</Text>
      </View>
    );
  }

  const { story } = job;
  const segments = story.segments;

  const handlePlaySegment = useCallback(async (segment: StorySegment) => {
    playbackEndRef.current = segment.timestamp_end * 1000;
    setPlayingSegment(segment);
  }, []);

  const handleVideoLoad = useCallback(async () => {
    if (videoRef.current && playingSegment) {
      await videoRef.current.setPositionAsync(playingSegment.timestamp_start * 1000);
      await videoRef.current.playAsync();
    }
  }, [playingSegment]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.positionMillis >= playbackEndRef.current && status.isPlaying) {
      videoRef.current?.pauseAsync();
    }
  }, []);

  const handleClosePlayer = useCallback(async () => {
    if (videoRef.current) {
      await videoRef.current.pauseAsync();
    }
    setPlayingSegment(null);
  }, []);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Progress dots */}
      <View className="flex-row px-4 pt-3 pb-2 gap-1">
        {segments.map((_, i) => (
          <View
            key={i}
            className="flex-1 h-1 rounded-full"
            style={{
              backgroundColor: i <= activeSegment ? "#0F172A" : "#E2E8F0",
            }}
          />
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Summary Header */}
        <View className="px-5 pt-3 pb-4">
          <Text className="text-lg font-bold text-slate-900">
            Job Story
          </Text>
          <Text className="text-sm text-slate-500 mt-1 leading-5">
            {story.summary}
          </Text>
          <View className="flex-row items-center mt-2">
            <FontAwesome name="clock-o" size={11} color="#94A3B8" />
            <Text className="text-xs text-slate-400 ml-1.5">
              {formatTimestamp(segments[segments.length - 1]?.timestamp_end || 0)} total
            </Text>
            <Text className="text-xs text-slate-300 mx-2">·</Text>
            <FontAwesome name="film" size={11} color="#94A3B8" />
            <Text className="text-xs text-slate-400 ml-1.5">
              {segments.length} key moments
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View className="px-4">
          {segments.map((segment, i) => {
            const tagColor = getTagColor(segment.tag);
            const isActive = i === activeSegment;
            const thumbnail = STORY_THUMBNAILS[segment.thumbnail_path];

            return (
              <Pressable
                key={segment.id}
                onPress={() => {
                  setActiveSegment(i);
                  handlePlaySegment(segment);
                }}
                className="flex-row mb-0"
              >
                {/* Timeline Rail */}
                <View className="items-center w-8 mr-3">
                  {/* Dot */}
                  <View
                    className="w-4 h-4 rounded-full items-center justify-center z-10"
                    style={{
                      backgroundColor: isActive ? tagColor : "#E2E8F0",
                      borderWidth: isActive ? 0 : 1,
                      borderColor: "#CBD5E1",
                    }}
                  >
                    {isActive && (
                      <View className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </View>
                  {/* Line */}
                  {i < segments.length - 1 && (
                    <View
                      className="w-0.5 flex-1"
                      style={{
                        backgroundColor: i < activeSegment ? tagColor : "#E2E8F0",
                      }}
                    />
                  )}
                </View>

                {/* Content Card */}
                <View
                  className="flex-1 mb-4 rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: "#fff",
                    borderWidth: isActive ? 1.5 : 1,
                    borderColor: isActive ? tagColor + "40" : "#F1F5F9",
                    shadowColor: "#0F172A",
                    shadowOffset: { width: 0, height: isActive ? 4 : 1 },
                    shadowOpacity: isActive ? 0.08 : 0.03,
                    shadowRadius: isActive ? 12 : 4,
                    elevation: isActive ? 4 : 1,
                  }}
                >
                  {/* Thumbnail */}
                  {thumbnail && (
                    <View style={{ position: "relative" }}>
                      <Image
                        source={thumbnail}
                        style={{
                          width: "100%",
                          height: isActive ? 160 : 100,
                        }}
                        resizeMode="cover"
                      />
                      {/* Play button overlay */}
                      {isActive && (
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: "rgba(0,0,0,0.5)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <FontAwesome name="play" size={16} color="#fff" />
                          </View>
                        </View>
                      )}
                      {/* Timestamp badge */}
                      <View className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-lg flex-row items-center">
                        <FontAwesome name="clock-o" size={9} color="#fff" />
                        <Text className="text-xs text-white font-mono ml-1">
                          {formatTimestamp(segment.timestamp_start)} – {formatTimestamp(segment.timestamp_end)}
                        </Text>
                      </View>
                      {/* Duration */}
                      <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded-lg">
                        <Text className="text-xs text-white font-mono">
                          {formatTimestamp(segment.timestamp_end - segment.timestamp_start)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Text */}
                  <View className="p-3.5">
                    <View className="flex-row items-center mb-1.5">
                      <View
                        className="flex-row items-center px-2 py-1 rounded-md mr-2"
                        style={{ backgroundColor: tagColor + "14" }}
                      >
                        <FontAwesome
                          name={getTagIcon(segment.tag)}
                          size={10}
                          color={tagColor}
                        />
                        <Text
                          className="text-xs font-bold ml-1.5 uppercase"
                          style={{ color: tagColor }}
                        >
                          {segment.tag}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm font-bold text-slate-900">
                      {segment.title}
                    </Text>
                    {isActive && (
                      <Text className="text-sm text-slate-500 mt-1.5 leading-5">
                        {segment.description}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Video Player Modal */}
      <Modal
        visible={playingSegment !== null}
        animationType="slide"
        transparent
        onRequestClose={handleClosePlayer}
      >
        <View className="flex-1 bg-black/90 justify-center">
          {/* Close button */}
          <Pressable
            onPress={handleClosePlayer}
            style={{
              position: "absolute",
              top: 60,
              right: 20,
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FontAwesome name="close" size={18} color="#fff" />
          </Pressable>

          {/* Segment info */}
          {playingSegment && (
            <View className="px-5 mb-4">
              <View
                className="flex-row items-center px-2.5 py-1 rounded-md self-start mb-2"
                style={{ backgroundColor: getTagColor(playingSegment.tag) + "30" }}
              >
                <FontAwesome
                  name={getTagIcon(playingSegment.tag)}
                  size={10}
                  color={getTagColor(playingSegment.tag)}
                />
                <Text
                  className="text-xs font-bold ml-1.5 uppercase"
                  style={{ color: getTagColor(playingSegment.tag) }}
                >
                  {playingSegment.tag}
                </Text>
              </View>
              <Text className="text-white font-bold text-base">
                {playingSegment.title}
              </Text>
              <Text className="text-white/50 text-xs mt-1">
                {formatTimestamp(playingSegment.timestamp_start)} – {formatTimestamp(playingSegment.timestamp_end)}
              </Text>
            </View>
          )}

          {/* Video or Thumbnail Fallback */}
          {playingSegment && (
            <View
              style={{
                width: SCREEN_WIDTH,
                height: SCREEN_WIDTH * (9 / 16),
                backgroundColor: "#000",
              }}
            >
              {story.video_path ? (
                <Video
                  ref={videoRef}
                  source={{ uri: story.video_path }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  onLoad={handleVideoLoad}
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                />
              ) : (
                <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                  {STORY_THUMBNAILS[playingSegment.thumbnail_path] && (
                    <Image
                      source={STORY_THUMBNAILS[playingSegment.thumbnail_path]}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  )}
                  <View
                    style={{
                      position: "absolute",
                      backgroundColor: "rgba(0,0,0,0.4)",
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                      Video not linked — reload sample data
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Description below video */}
          {playingSegment && (
            <View className="px-5 mt-4">
              <Text className="text-white/70 text-sm leading-5">
                {playingSegment.description}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
