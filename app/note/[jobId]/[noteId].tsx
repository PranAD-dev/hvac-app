import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useJobStore } from "../../../store/jobStore";
import { FontAwesome } from "@expo/vector-icons";

const AVAILABLE_TAGS = [
  "Urgent",
  "Follow-up",
  "Safety",
  "Maintenance",
  "Parts Needed",
  "Warranty",
  "Customer Request",
  "Inspection",
];

const AVAILABLE_CATEGORIES = [
  { id: "inspection", label: "Inspection", icon: "eye" as const, color: "#2563EB" },
  { id: "repair", label: "Repair", icon: "wrench" as const, color: "#DC2626" },
  { id: "installation", label: "Installation", icon: "plus-circle" as const, color: "#7C3AED" },
  { id: "maintenance", label: "Maintenance", icon: "cogs" as const, color: "#EA580C" },
  { id: "diagnosis", label: "Diagnosis", icon: "stethoscope" as const, color: "#0D9488" },
  { id: "customer", label: "Customer Note", icon: "user" as const, color: "#1E3A5F" },
];

const AI_ACTIONS = [
  {
    id: "summarize",
    title: "Summarize\nNote",
    icon: "magic" as const,
    iconColor: "#65A30D",
    bgColor: "#F0FDF4",
  },
  {
    id: "rewrite",
    title: "Rewrite for\nClarity",
    icon: "refresh" as const,
    iconColor: "#7C3AED",
    bgColor: "#F5F3FF",
  },
  {
    id: "bullets",
    title: "Convert to\nBullets",
    icon: "list-ul" as const,
    iconColor: "#DC2626",
    bgColor: "#FFF1F2",
  },
  {
    id: "title",
    title: "Generate\nTitle",
    icon: "font" as const,
    iconColor: "#1E3A5F",
    bgColor: "#FFF1F2",
  },
];

export default function NoteDetailScreen() {
  const { jobId, noteId } = useLocalSearchParams<{
    jobId: string;
    noteId: string;
  }>();
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const { deleteNote, updateNote, updateNoteMetadata } = useJobStore();

  const job = jobs.find((j) => j.id === jobId);
  const note = (job?.notes || []).find((n) => n.id === noteId);

  const [title, setTitle] = useState(job?.customer_name || "");
  const [text, setText] = useState(note?.text || "");
  const [edited, setEdited] = useState(false);

  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(note?.tags || []);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(note?.category || "");

  if (!job || !note) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAFAFA",
        }}
      >
        <Text style={{ color: "#9CA3AF" }}>Note not found</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!text.trim()) return;
    await updateNote(jobId, noteId, text.trim());
    setEdited(false);
    Alert.alert("Saved", "Note updated.");
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveTags = async () => {
    await updateNoteMetadata(jobId, noteId, { tags: selectedTags });
    setShowTagModal(false);
  };

  const handleSaveCategory = async (catId: string) => {
    const newCat = catId === selectedCategory ? "" : catId;
    setSelectedCategory(newCat);
    await updateNoteMetadata(jobId, noteId, { category: newCat });
    setShowCategoryModal(false);
  };

  const activeCategory = AVAILABLE_CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: "Create Note",
          headerTitleStyle: { fontWeight: "700", fontSize: 18, color: "#111827" },
          headerStyle: { backgroundColor: "#FAFAFA" },
          headerShadowVisible: false,
          headerTintColor: "#111827",
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <FontAwesome name="chevron-left" size={18} color="#111827" />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              hitSlop={12}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesome name="save" size={16} color="#111827" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: "#FAFAFA" }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title Input */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 52,
                backgroundColor: "#FFFFFF",
              }}
            >
              <TextInput
                value={title}
                onChangeText={(v) => {
                  setTitle(v);
                  setEdited(true);
                }}
                placeholder="Note title..."
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: "#111827",
                  fontWeight: "500",
                }}
              />
              <FontAwesome name="star" size={16} color="#9CA3AF" />
            </View>
          </View>

          {/* Notes Text Area */}
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                backgroundColor: "#FFFFFF",
                padding: 16,
                minHeight: 200,
              }}
            >
              <TextInput
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  setEdited(true);
                }}
                multiline
                textAlignVertical="top"
                placeholder="Write Your Notes..."
                placeholderTextColor="#9CA3AF"
                style={{
                  fontSize: 15,
                  color: "#111827",
                  lineHeight: 22,
                  minHeight: 170,
                }}
              />
            </View>
          </View>

          {/* Tags Display */}
          {selectedTags.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, paddingTop: 10, gap: 6 }}>
              {selectedTags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#EFF6FF",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <FontAwesome name="tag" size={10} color="#2563EB" />
                  <Text style={{ fontSize: 12, color: "#2563EB", fontWeight: "500" }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Category Display */}
          {activeCategory && (
            <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 8, gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: activeCategory.color + "14",
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <FontAwesome name={activeCategory.icon} size={10} color={activeCategory.color} />
                <Text style={{ fontSize: 12, color: activeCategory.color, fontWeight: "500" }}>{activeCategory.label}</Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 20,
              paddingTop: 14,
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => setShowTagModal(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: selectedTags.length > 0 ? "#2563EB" : "#E5E7EB",
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: selectedTags.length > 0 ? "#EFF6FF" : "#FFFFFF",
              }}
            >
              <FontAwesome name="tag" size={13} color={selectedTags.length > 0 ? "#2563EB" : "#DC2626"} />
              <Text
                style={{ fontSize: 13, color: selectedTags.length > 0 ? "#2563EB" : "#374151", fontWeight: "500" }}
              >
                {selectedTags.length > 0 ? `${selectedTags.length} Tag${selectedTags.length > 1 ? "s" : ""}` : "Add Tag"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowCategoryModal(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: selectedCategory ? "#16A34A" : "#E5E7EB",
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: selectedCategory ? "#F0FDF4" : "#FFFFFF",
              }}
            >
              <FontAwesome name="folder-open" size={13} color="#16A34A" />
              <Text
                style={{ fontSize: 13, color: selectedCategory ? "#16A34A" : "#374151", fontWeight: "500" }}
              >
                {activeCategory ? activeCategory.label : "Add Category"}
              </Text>
            </Pressable>
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: "#FFFFFF",
              }}
            >
              <FontAwesome name="clock-o" size={14} color="#0D9488" />
              <Text
                style={{ fontSize: 13, color: "#374151", fontWeight: "500" }}
              >
                Reminder
              </Text>
            </Pressable>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: "#E5E7EB",
              marginHorizontal: 20,
              marginTop: 20,
              marginBottom: 20,
            }}
          />

          {/* AI Assist Section */}
          <View style={{ paddingHorizontal: 20 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: "#111827",
                marginBottom: 16,
              }}
            >
              AI Assist
            </Text>

            {/* 2x2 Grid */}
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {AI_ACTIONS.slice(0, 2).map((action) => (
                  <Pressable
                    key={action.id}
                    style={{
                      flex: 1,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 16,
                      padding: 16,
                      minHeight: 120,
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: action.bgColor,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FontAwesome
                        name={action.icon}
                        size={18}
                        color={action.iconColor}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#111827",
                        marginTop: 12,
                        lineHeight: 20,
                      }}
                    >
                      {action.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {AI_ACTIONS.slice(2, 4).map((action) => (
                  <Pressable
                    key={action.id}
                    style={{
                      flex: 1,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 16,
                      padding: 16,
                      minHeight: 120,
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: action.bgColor,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FontAwesome
                        name={action.icon}
                        size={18}
                        color={action.iconColor}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#111827",
                        marginTop: 12,
                        lineHeight: 20,
                      }}
                    >
                      {action.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tag Selection Modal */}
      <Modal visible={showTagModal} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setShowTagModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: "60%",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>Add Tags</Text>
              <Pressable onPress={handleSaveTags} hitSlop={12}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#2563EB" }}>Done</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {AVAILABLE_TAGS.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: isActive ? "#2563EB" : "#E5E7EB",
                      backgroundColor: isActive ? "#EFF6FF" : "#FFFFFF",
                    }}
                  >
                    <FontAwesome name={isActive ? "check-circle" : "circle-o"} size={14} color={isActive ? "#2563EB" : "#9CA3AF"} />
                    <Text style={{ fontSize: 14, fontWeight: "500", color: isActive ? "#2563EB" : "#374151" }}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category Selection Modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setShowCategoryModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 20 }}>Select Category</Text>
            <View style={{ gap: 10 }}>
              {AVAILABLE_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleSaveCategory(cat.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: isActive ? cat.color : "#E5E7EB",
                      backgroundColor: isActive ? cat.color + "0D" : "#FFFFFF",
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: cat.color + "14",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FontAwesome name={cat.icon} size={16} color={cat.color} />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: isActive ? cat.color : "#374151", flex: 1 }}>{cat.label}</Text>
                    {isActive && <FontAwesome name="check-circle" size={18} color={cat.color} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
