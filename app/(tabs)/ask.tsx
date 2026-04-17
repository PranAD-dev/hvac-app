import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useJobStore } from "../../store/jobStore";

const RAG_SERVER = "http://10.0.0.48:3001";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "How did the Willow Creek job go?",
  "Which jobs had compressor issues?",
  "Difference between TXV and piston metering?",
  "How do I diagnose a grounded compressor?",
];

export default function AskScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const jobs = useJobStore((s) => s.jobs);

  useEffect(() => {
    syncJobs();
  }, [jobs]);

  const syncJobs = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${RAG_SERVER}/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      });
      const data = await res.json();
      if (data.ok) setSynced(true);
    } catch {}
    setSyncing(false);
  };

  const handleSend = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch(`${RAG_SERVER}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.answer || "Sorry, I couldn't find an answer.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: "Can't reach the RAG server. Make sure it's running:\nnode scripts/rag-server.js",
        },
      ]);
    }

    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Sync status */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 6,
        }}
      >
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            marginRight: 8,
            backgroundColor: synced ? "#22C55E" : syncing ? "#EAB308" : "#EF4444",
          }}
        />
        <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
          {synced
            ? `${jobs.length} jobs synced`
            : syncing
            ? "Syncing jobs..."
            : "Not connected"}
        </Text>
        {!synced && !syncing && (
          <Pressable onPress={syncJobs} style={{ marginLeft: 8 }}>
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: "#1E3A5F" }}
            >
              Retry
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 16, paddingTop: 8 }}
      >
        {messages.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 48 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: "#F0F4F8",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <FontAwesome name="comments" size={28} color="#1E3A5F" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#111827",
                marginBottom: 6,
              }}
            >
              Ask about your jobs
            </Text>
            <Text
              style={{
                fontSize: 14,
                textAlign: "center",
                paddingHorizontal: 32,
                lineHeight: 20,
                color: "#9CA3AF",
              }}
            >
              Ask questions about past service calls, diagnoses, parts used, or
              anything from your job history.
            </Text>

            {/* Suggestion chips */}
            <View style={{ marginTop: 24, width: "100%" }}>
              {SUGGESTIONS.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleSend(s)}
                  style={{ marginBottom: 10 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#F0F4F8",
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                    }}
                  >
                    <FontAwesome
                      name="comment-o"
                      size={13}
                      color="#9CA3AF"
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        marginLeft: 12,
                        flex: 1,
                        color: "#374151",
                      }}
                    >
                      {s}
                    </Text>
                    <FontAwesome
                      name="arrow-right"
                      size={11}
                      color="#D1D5DB"
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((msg) => (
            <View
              key={msg.id}
              style={{
                marginBottom: 12,
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {msg.role === "user" ? (
                <View
                  style={{
                    maxWidth: "85%",
                    borderRadius: 18,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: "#1E3A5F",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 20,
                      color: "#FFFFFF",
                    }}
                  >
                    {msg.text}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    maxWidth: "85%",
                    borderRadius: 18,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: "#F0F4F8",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 20,
                      color: "#374151",
                    }}
                  >
                    {msg.text}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}

        {loading && (
          <View style={{ alignItems: "flex-start", marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F0F4F8",
                borderRadius: 18,
                paddingHorizontal: 20,
                paddingVertical: 14,
              }}
            >
              <ActivityIndicator size="small" color="#1E3A5F" />
              <Text
                style={{ fontSize: 14, marginLeft: 10, color: "#9CA3AF" }}
              >
                Thinking...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 16,
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            borderRadius: 16,
            paddingHorizontal: 16,
            backgroundColor: "#F3F4F6",
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your jobs..."
            placeholderTextColor="#9CA3AF"
            multiline
            style={{
              flex: 1,
              fontSize: 14,
              color: "#111827",
              paddingVertical: 12,
              maxHeight: 96,
            }}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              marginLeft: 8,
              marginBottom: 10,
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: input.trim() ? "#1E3A5F" : "#D1D5DB",
            }}
          >
            <FontAwesome
              name="arrow-up"
              size={14}
              color={input.trim() ? "#FFFFFF" : "#9CA3AF"}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
