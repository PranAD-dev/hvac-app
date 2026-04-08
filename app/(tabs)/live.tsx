import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { useJobStore } from "../../store/jobStore";
import { Note, Clip } from "../../types";

type Filter = "all" | "notes" | "clips";

interface FeedItem {
  type: "note" | "clip";
  item: Note | Clip;
  jobId: string;
  customerName: string;
  customerAddress: string;
  timestamp: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function NoteItem({
  note,
  customerName,
  onPress,
}: {
  note: Note;
  customerName: string;
  onPress: () => void;
}) {
  const isVision = note.source === "vision";
  return (
    <Pressable
      onPress={onPress}
      className="bg-white mx-4 mb-2.5 rounded-2xl overflow-hidden"
      style={{
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View style={{ height: 2, backgroundColor: isVision ? "#7C3AED" : "#2563EB" }} />
      <View className="p-4">
        <View className="flex-row items-center mb-2">
          <View
            className="w-7 h-7 rounded-lg items-center justify-center mr-2.5"
            style={{ backgroundColor: isVision ? "#7C3AED14" : "#2563EB14" }}
          >
            <FontAwesome
              name={isVision ? "eye" : "pencil"}
              size={11}
              color={isVision ? "#7C3AED" : "#2563EB"}
            />
          </View>
          <View
            className="px-2 py-0.5 rounded-md mr-2"
            style={{ backgroundColor: isVision ? "#7C3AED14" : "#2563EB14" }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: isVision ? "#7C3AED" : "#2563EB" }}
            >
              {isVision ? "VISION" : "NOTE"}
            </Text>
          </View>
          <Text className="text-xs text-slate-400 flex-1" numberOfLines={1}>
            {customerName}
          </Text>
          <Text className="text-xs text-slate-300">
            {formatTime(note.created_at)}
          </Text>
        </View>
        <Text className="text-sm text-slate-700 leading-5" numberOfLines={3}>
          {note.text}
        </Text>
      </View>
    </Pressable>
  );
}

function ClipItem({
  clip,
  customerName,
  onPress,
}: {
  clip: Clip;
  customerName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white mx-4 mb-2.5 rounded-2xl overflow-hidden"
      style={{
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View style={{ height: 2, backgroundColor: "#16A34A" }} />
      <View className="p-4">
        <View className="flex-row items-center mb-2">
          <View className="w-7 h-7 rounded-lg items-center justify-center mr-2.5 bg-green-50">
            <FontAwesome name="video-camera" size={11} color="#16A34A" />
          </View>
          <View className="px-2 py-0.5 rounded-md mr-2 bg-green-50">
            <Text className="text-xs font-bold text-green-600">CLIP</Text>
          </View>
          <Text className="text-xs text-slate-400 flex-1" numberOfLines={1}>
            {customerName}
          </Text>
          <Text className="text-xs text-slate-300">
            {formatTime(clip.recorded_at)}
          </Text>
        </View>
        <Text className="text-sm text-slate-700 leading-5" numberOfLines={2}>
          {clip.caption}
        </Text>
        <View className="flex-row items-center mt-2">
          <FontAwesome name="clock-o" size={10} color="#94A3B8" />
          <Text className="text-xs text-slate-400 ml-1">
            {formatDuration(clip.duration_seconds)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function NotesClipsScreen() {
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const [filter, setFilter] = useState<Filter>("all");

  const { sections, totalNotes, totalClips } = useMemo(() => {
    const feed: FeedItem[] = [];

    for (const job of jobs) {
      for (const note of job.notes || []) {
        feed.push({
          type: "note",
          item: note,
          jobId: job.id,
          customerName: job.customer_name,
          customerAddress: job.customer_address,
          timestamp: note.created_at,
        });
      }
      for (const clip of job.clips || []) {
        feed.push({
          type: "clip",
          item: clip,
          jobId: job.id,
          customerName: job.customer_name,
          customerAddress: job.customer_address,
          timestamp: clip.recorded_at,
        });
      }
    }

    const filtered = feed.filter((f) => {
      if (filter === "notes") return f.type === "note";
      if (filter === "clips") return f.type === "clip";
      return true;
    });

    filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const grouped: Record<string, FeedItem[]> = {};
    for (const item of filtered) {
      const day = formatDate(item.timestamp);
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(item);
    }

    const sectionList = Object.entries(grouped).map(([title, data]) => ({
      title,
      data,
    }));

    return {
      sections: sectionList,
      totalNotes: feed.filter((f) => f.type === "note").length,
      totalClips: feed.filter((f) => f.type === "clip").length,
    };
  }, [jobs, filter]);

  return (
    <View className="flex-1 bg-slate-50">
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.type}-${(item.item as any).id}-${index}`}
        contentContainerStyle={{ paddingBottom: 24 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            {/* Stats */}
            <View className="flex-row px-4 py-4 gap-3">
              <View
                className="flex-1 bg-white rounded-2xl py-3.5 items-center"
                style={{
                  shadowColor: "#0F172A",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mb-1.5">
                  <FontAwesome name="pencil" size={13} color="#2563EB" />
                </View>
                <Text className="text-xl font-bold text-slate-900">{totalNotes}</Text>
                <Text className="text-xs text-slate-400">Notes</Text>
              </View>
              <View
                className="flex-1 bg-white rounded-2xl py-3.5 items-center"
                style={{
                  shadowColor: "#0F172A",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View className="w-8 h-8 rounded-full bg-green-50 items-center justify-center mb-1.5">
                  <FontAwesome name="video-camera" size={13} color="#16A34A" />
                </View>
                <Text className="text-xl font-bold text-slate-900">{totalClips}</Text>
                <Text className="text-xs text-slate-400">Clips</Text>
              </View>
            </View>

            {/* Filter pills */}
            <View className="flex-row px-4 mb-3 gap-2">
              {(["all", "notes", "clips"] as Filter[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  className="px-4 py-2 rounded-full"
                  style={{
                    backgroundColor: filter === f ? "#0F172A" : "#fff",
                    shadowColor: filter === f ? "transparent" : "#0F172A",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: filter === f ? 0 : 0.04,
                    shadowRadius: 4,
                    elevation: filter === f ? 0 : 1,
                  }}
                >
                  <Text
                    className="text-xs font-bold capitalize"
                    style={{ color: filter === f ? "#fff" : "#64748B" }}
                  >
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mx-5 mb-2 mt-4">
            {title}
          </Text>
        )}
        renderItem={({ item: feedItem }) => {
          const goToJob = () => router.push(`/job/${feedItem.jobId}`);
          if (feedItem.type === "note") {
            return (
              <NoteItem
                note={feedItem.item as Note}
                customerName={feedItem.customerName}
                onPress={goToJob}
              />
            );
          }
          return (
            <ClipItem
              clip={feedItem.item as Clip}
              customerName={feedItem.customerName}
              onPress={goToJob}
            />
          );
        }}
        ListEmptyComponent={
          <View className="items-center px-8 pt-16">
            <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
              <FontAwesome name="sticky-note-o" size={32} color="#CBD5E1" />
            </View>
            <Text className="text-xl font-bold text-slate-300">
              {filter === "clips" ? "No Clips Yet" : filter === "notes" ? "No Notes Yet" : "Nothing Yet"}
            </Text>
            <Text className="text-sm text-slate-400 mt-2 text-center leading-5">
              Notes and clips from your jobs will show up here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
