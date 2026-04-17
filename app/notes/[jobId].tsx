import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useJobStore } from "../../store/jobStore";
import { FontAwesome } from "@expo/vector-icons";
import { Note } from "../../types";

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

export default function NotesListScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const { addNote, deleteNote } = useJobStore();
  const techName = useJobStore((s) => s.techName);
  const [showModal, setShowModal] = useState(false);
  const [noteText, setNoteText] = useState("");

  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#F2F4F7" }}>
        <Text className="text-gray-400">Job not found</Text>
      </View>
    );
  }

  const notes = job.notes || [];

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote(job.id, noteText, "manual", techName);
    setNoteText("");
    setShowModal(false);
  };

  const handleDelete = (note: Note) => {
    Alert.alert("Delete Note", "Remove this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteNote(job.id, note.id),
      },
    ]);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#F2F4F7" }}>
      <Pressable
        onPress={() => router.push(`/job/${job.id}`)}
        className="mx-4 mt-3 mb-1 rounded-xl overflow-hidden"
        style={{ backgroundColor: "#1E3A5F" }}
      >
        <View className="flex-row items-center px-4 py-3">
          <View
            className="w-9 h-9 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <FontAwesome name="briefcase" size={14} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-sm">
              {job.customer_name}
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: "#BFDBFE" }}>
              Go to job detail
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color="#BFDBFE" />
        </View>
      </Pressable>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 12 }}
        ListEmptyComponent={
          <View className="items-center justify-center pt-24">
            <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-3">
              <FontAwesome name="sticky-note-o" size={24} color="#9CA3AF" />
            </View>
            <Text className="text-base font-semibold text-gray-800">No Notes</Text>
            <Text className="text-xs text-gray-400 mt-1">Tap the button below to add one</Text>
          </View>
        }
        renderItem={({ item: note }) => {
          const isVision = note.source === "vision";
          const tagColor = isVision ? "#7C3AED" : "#2563EB";
          const tagLabel = isVision ? "Vision" : "Manual";
          return (
            <Pressable
              onPress={() => router.push(`/note/${job.id}/${note.id}`)}
              onLongPress={() => handleDelete(note)}
              className="mx-4 mb-2.5"
            >
              <View
                className="bg-white rounded-xl overflow-hidden flex-row"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <View className="flex-1 p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-gray-900 flex-1 mr-3" numberOfLines={1}>
                      {note.text}
                    </Text>
                    <View className="px-2 py-0.5 rounded" style={{ backgroundColor: "#FFFFFF" }}>
                      <Text className="text-xs font-semibold" style={{ color: tagColor }}>{tagLabel}</Text>
                    </View>
                  </View>

                  <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>
                    {note.text}
                  </Text>

                  <View className="flex-row items-center mt-2.5 gap-2">
                    <View className="flex-row items-center">
                      <FontAwesome name="clock-o" size={11} color="#9CA3AF" />
                      <Text className="text-xs text-gray-400 ml-1">
                        {formatDateTime(note.created_at)}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-400">
                      {note.created_by}
                    </Text>
                  </View>
                </View>

                <View className="justify-center pr-4">
                  <FontAwesome name="chevron-right" size={12} color="#D1D5DB" />
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Add Note Button */}
      <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3" style={{ backgroundColor: "#F2F4F7" }}>
        <Pressable
          onPress={() => setShowModal(true)}
          className="py-4 rounded-xl items-center"
          style={{ backgroundColor: "#1E3A5F" }}
        >
          <View className="flex-row items-center">
            <FontAwesome name="plus" size={13} color="#fff" />
            <Text className="text-sm font-bold text-white ml-2">Add Note</Text>
          </View>
        </Pressable>
      </View>

      {/* Add Note Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable className="flex-1" onPress={() => setShowModal(false)} />
          <View
            className="bg-white rounded-t-2xl px-5 pt-6 pb-10"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <Text className="text-lg font-bold text-gray-900 mb-1">New Note</Text>
            <Text className="text-sm text-gray-400 mb-5">
              {job.customer_name} — {job.customer_address}
            </Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What did you observe or want to remember?"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              className="bg-gray-50 rounded-xl px-4 py-3.5 text-sm text-gray-900 mb-6"
              style={{ minHeight: 120 }}
              autoFocus
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setShowModal(false);
                  setNoteText("");
                }}
                className="flex-1 py-4 rounded-xl items-center bg-gray-100"
              >
                <Text className="text-sm font-bold text-gray-600">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddNote}
                className="flex-1 py-4 rounded-xl items-center"
                style={{ backgroundColor: "#1E3A5F" }}
              >
                <View className="flex-row items-center">
                  <FontAwesome name="check" size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white ml-1.5">Save</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
