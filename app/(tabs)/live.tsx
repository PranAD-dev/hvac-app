import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
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

const noteTypes = [
  {
    id: "text",
    title: "Text Note",
    subtitle: "Write and save your thoughts",
    icon: "font" as const,
    highlighted: false,
  },
  {
    id: "voice",
    title: "Voice Note",
    subtitle: "Record and save your voice",
    icon: "microphone" as const,
    highlighted: true,
  },
  {
    id: "image",
    title: "Image Note",
    subtitle: "Capture notes from images",
    icon: "image" as const,
    highlighted: false,
  },
  {
    id: "ai",
    title: "AI Note",
    subtitle: "Create notes with AI assistance",
    icon: "magic" as const,
    highlighted: false,
  },
];

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 Day Ago";
  return `${diffDays} Days Ago`;
}

function NoteTypeCard({
  title,
  subtitle,
  icon,
  highlighted,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: any;
  highlighted: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: highlighted ? "#1E3A5F" : "#F8F9FB",
          borderRadius: 16,
          padding: 16,
          minHeight: 160,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: highlighted ? "rgba(255,255,255,0.25)" : "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: highlighted ? 0 : 0.06,
            shadowRadius: 3,
            elevation: highlighted ? 0 : 2,
          }}
        >
          <FontAwesome
            name={icon}
            size={18}
            color={highlighted ? "#FFFFFF" : "#374151"}
          />
        </View>
        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: highlighted ? "#FFFFFF" : "#111827",
              marginBottom: 4,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: highlighted ? "rgba(255,255,255,0.8)" : "#9CA3AF",
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function RecentNoteCard({
  note,
  customerName,
  onPress,
  onDelete,
}: {
  note: Note;
  customerName: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isVision = note.source === "vision";
  const handleMenu = () => {
    Alert.alert(customerName, "Note options", [
      { text: "Open", onPress },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete Note", "Remove this note?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: "#F0F4F8",
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {customerName}
          </Text>
          <Pressable hitSlop={8} onPress={handleMenu}>
            <FontAwesome name="ellipsis-v" size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginTop: 12,
            gap: 8,
          }}
        >
          <FontAwesome
            name="check-square"
            size={16}
            color="#1E3A5F"
            style={{ marginTop: 2 }}
          />
          <Text
            style={{ fontSize: 14, color: "#374151", flex: 1 }}
            numberOfLines={2}
          >
            {note.text}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "#D1D5DB",
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#374151", fontWeight: "500" }}
              >
                {isVision ? "Vision" : "Manual"}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "#D1D5DB",
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#374151", fontWeight: "500" }}
              >
                {note.created_by}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <FontAwesome name="calendar-o" size={12} color="#9CA3AF" />
            <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
              {formatRelativeDate(note.created_at)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RecentClipCard({
  clip,
  customerName,
  onPress,
  onDelete,
}: {
  clip: Clip;
  customerName: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const handleMenu = () => {
    Alert.alert(customerName, "Clip options", [
      { text: "View Job", onPress },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete Clip", "Remove this clip?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: "#F0F4F8",
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {customerName}
          </Text>
          <Pressable hitSlop={8} onPress={handleMenu}>
            <FontAwesome name="ellipsis-v" size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 12,
            gap: 8,
          }}
        >
          <FontAwesome
            name="video-camera"
            size={14}
            color="#1E3A5F"
            style={{ marginTop: 1 }}
          />
          <Text
            style={{ fontSize: 14, color: "#374151", flex: 1 }}
            numberOfLines={2}
          >
            {clip.caption}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "#D1D5DB",
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#374151", fontWeight: "500" }}
              >
                Clip
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "#D1D5DB",
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#374151", fontWeight: "500" }}
              >
                {clip.recorded_by}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <FontAwesome name="calendar-o" size={12} color="#9CA3AF" />
            <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
              {formatRelativeDate(clip.recorded_at)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function NotesClipsScreen() {
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const { addNote, deleteNote, deleteClip } = useJobStore();
  const techName = useJobStore((s) => s.techName);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showTextNoteModal, setShowTextNoteModal] = useState(false);
  const [textNoteContent, setTextNoteContent] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const handleCreateTextNote = async () => {
    const targetJobId = selectedJobId || (jobs.length > 0 ? jobs[0].id : "");
    if (!targetJobId) {
      Alert.alert("No Jobs", "Create a job first before adding notes.");
      return;
    }
    if (!textNoteContent.trim()) {
      Alert.alert("Empty Note", "Write something before saving.");
      return;
    }
    await addNote(targetJobId, textNoteContent.trim(), "manual", techName);
    setTextNoteContent("");
    setSelectedJobId("");
    setShowTextNoteModal(false);
    Alert.alert("Saved", "Text note created.");
  };

  const handleNoteTypePress = (typeId: string) => {
    if (typeId === "voice") {
      router.push("/voice-note");
      return;
    }
    if (typeId === "text") {
      if (jobs.length === 0) {
        Alert.alert("No Jobs", "Create a job first before adding notes.");
        return;
      }
      setSelectedJobId(jobs[0].id);
      setShowTextNoteModal(true);
      return;
    }
    if (typeId === "image") {
      Alert.alert(
        "Image Note",
        "Camera integration captures photos and converts them to notes using OCR. This feature requires camera hardware access.",
        [{ text: "OK" }]
      );
      return;
    }
    if (typeId === "ai") {
      if (jobs.length === 0) {
        Alert.alert("No Jobs", "Create a job first before adding notes.");
        return;
      }
      Alert.alert(
        "AI Note",
        "Describe what you need and AI will generate a note.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Create",
            onPress: () => {
              setSelectedJobId(jobs[0].id);
              setShowTextNoteModal(true);
            },
          },
        ]
      );
      return;
    }
  };

  const feedItems = useMemo(() => {
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

    let filtered = feed.filter((f) => {
      if (filter === "notes") return f.type === "note";
      if (filter === "clips") return f.type === "clip";
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((f) => {
        if (f.type === "note") {
          return (
            (f.item as Note).text.toLowerCase().includes(q) ||
            f.customerName.toLowerCase().includes(q)
          );
        }
        return (
          (f.item as Clip).caption.toLowerCase().includes(q) ||
          f.customerName.toLowerCase().includes(q)
        );
      });
    }

    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return filtered;
  }, [jobs, filter, searchQuery]);

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Search Bar */}
        <View
          style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F3F4F6",
              borderRadius: 12,
              paddingHorizontal: 14,
              height: 48,
            }}
          >
            <FontAwesome name="search" size={16} color="#9CA3AF" />
            <TextInput
              placeholder="Search notes, tags..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                marginLeft: 10,
                fontSize: 15,
                color: "#111827",
              }}
            />
            <Pressable onPress={() => router.push("/voice-note")} hitSlop={8}>
              <FontAwesome name="microphone" size={18} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>

        {/* Note Type Cards - 2x2 Grid */}
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {noteTypes.slice(0, 2).map((nt) => (
              <NoteTypeCard
                key={nt.id}
                title={nt.title}
                subtitle={nt.subtitle}
                icon={nt.icon}
                highlighted={nt.highlighted}
                onPress={() => handleNoteTypePress(nt.id)}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {noteTypes.slice(2, 4).map((nt) => (
              <NoteTypeCard
                key={nt.id}
                title={nt.title}
                subtitle={nt.subtitle}
                icon={nt.icon}
                highlighted={nt.highlighted}
                onPress={() => handleNoteTypePress(nt.id)}
              />
            ))}
          </View>
        </View>

        {/* Recent Notes Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 28,
            paddingBottom: 4,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#111827" }}>
            Recent Notes
          </Text>
        </View>

        {/* Filter Pills */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            marginTop: 12,
            marginBottom: 16,
            gap: 8,
          }}
        >
          {(["all", "notes", "clips"] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: filter === f ? "#1E3A5F" : "#F3F4F6",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: filter === f ? "#FFFFFF" : "#6B7280",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Feed Items */}
        <View style={{ paddingHorizontal: 16 }}>
          {feedItems.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <FontAwesome
                  name="sticky-note-o"
                  size={24}
                  color="#9CA3AF"
                />
              </View>
              <Text
                style={{ fontSize: 18, fontWeight: "600", color: "#1F2937" }}
              >
                {filter === "clips"
                  ? "No Clips Yet"
                  : filter === "notes"
                  ? "No Notes Yet"
                  : "Nothing Yet"}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#9CA3AF",
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                Notes and clips from your jobs will show up here.
              </Text>
            </View>
          ) : (
            feedItems.map((feedItem, index) => {
              if (feedItem.type === "note") {
                const note = feedItem.item as Note;
                return (
                  <RecentNoteCard
                    key={`note-${note.id}-${index}`}
                    note={note}
                    customerName={feedItem.customerName}
                    onPress={() =>
                      router.push(`/note/${feedItem.jobId}/${note.id}`)
                    }
                    onDelete={() => deleteNote(feedItem.jobId, note.id)}
                  />
                );
              }
              const clip = feedItem.item as Clip;
              return (
                <RecentClipCard
                  key={`clip-${clip.id}-${index}`}
                  clip={clip}
                  customerName={feedItem.customerName}
                  onPress={() => router.push(`/job/${feedItem.jobId}`)}
                  onDelete={() => deleteClip(feedItem.jobId, clip.id)}
                />
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Text Note Creation Modal */}
      <Modal visible={showTextNoteModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
            onPress={() => setShowTextNoteModal(false)}
          >
            <Pressable
              style={{
                backgroundColor: "#FFFFFF",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                maxHeight: "80%",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>New Text Note</Text>
                <Pressable onPress={() => setShowTextNoteModal(false)} hitSlop={12}>
                  <FontAwesome name="times" size={20} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Job Selector */}
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 8 }}>Attach to Job</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, maxHeight: 44 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {jobs.map((j) => (
                    <Pressable
                      key={j.id}
                      onPress={() => setSelectedJobId(j.id)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: selectedJobId === j.id ? "#1E3A5F" : "#F3F4F6",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: selectedJobId === j.id ? "#FFFFFF" : "#6B7280",
                        }}
                        numberOfLines={1}
                      >
                        {j.customer_name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Note Input */}
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 12,
                  backgroundColor: "#F9FAFB",
                  padding: 14,
                  minHeight: 150,
                  marginBottom: 16,
                }}
              >
                <TextInput
                  value={textNoteContent}
                  onChangeText={setTextNoteContent}
                  multiline
                  textAlignVertical="top"
                  placeholder="Write your note..."
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  style={{
                    fontSize: 15,
                    color: "#111827",
                    lineHeight: 22,
                    minHeight: 130,
                  }}
                />
              </View>

              <Pressable
                onPress={handleCreateTextNote}
                style={({ pressed }) => ({
                  backgroundColor: "#1E3A5F",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>Save Note</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
