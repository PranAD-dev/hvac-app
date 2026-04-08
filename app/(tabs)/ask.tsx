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

const RAG_SERVER = "http://10.104.9.16:9091";

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

  // Sync jobs to RAG server on mount
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
    } catch {
      // Server not running — still allow general HVAC questions
    }
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
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Sync status */}
      <View className="px-4 pt-2 pb-1 flex-row items-center">
        <View
          className="w-2 h-2 rounded-full mr-2"
          style={{ backgroundColor: synced ? "#16A34A" : syncing ? "#CA8A04" : "#DC2626" }}
        />
        <Text className="text-xs text-slate-400">
          {synced
            ? `${jobs.length} jobs synced`
            : syncing
            ? "Syncing jobs..."
            : "Not connected"}
        </Text>
        {!synced && !syncing && (
          <Pressable onPress={syncJobs} className="ml-2">
            <Text className="text-xs text-blue-500 font-bold">Retry</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 16, paddingTop: 8 }}
      >
        {messages.length === 0 ? (
          <View className="items-center pt-12">
            <View className="w-16 h-16 rounded-2xl bg-slate-900 items-center justify-center mb-4">
              <FontAwesome name="comments" size={28} color="#fff" />
            </View>
            <Text className="text-lg font-bold text-slate-900 mb-1">
              Ask about your jobs
            </Text>
            <Text className="text-sm text-slate-400 text-center px-8 leading-5">
              Ask questions about past service calls, diagnoses, parts used, or
              anything from your job history.
            </Text>

            {/* Suggestion chips */}
            <View className="mt-6 w-full">
              {SUGGESTIONS.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleSend(s)}
                  className="bg-white rounded-xl px-4 py-3.5 mb-2"
                  style={{
                    shadowColor: "#0F172A",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row items-center">
                    <FontAwesome name="comment-o" size={13} color="#94A3B8" />
                    <Text className="text-sm text-slate-700 ml-3 flex-1">
                      {s}
                    </Text>
                    <FontAwesome name="arrow-right" size={11} color="#CBD5E1" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((msg) => (
            <View
              key={msg.id}
              className={`mb-3 ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <View
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-slate-900"
                    : "bg-white"
                }`}
                style={
                  msg.role === "assistant"
                    ? {
                        shadowColor: "#0F172A",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 6,
                        elevation: 2,
                      }
                    : undefined
                }
              >
                <Text
                  className={`text-sm leading-5 ${
                    msg.role === "user" ? "text-white" : "text-slate-700"
                  }`}
                >
                  {msg.text}
                </Text>
              </View>
            </View>
          ))
        )}

        {loading && (
          <View className="items-start mb-3">
            <View
              className="bg-white rounded-2xl px-5 py-4"
              style={{
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#64748B" />
                <Text className="text-sm text-slate-400 ml-2.5">Thinking...</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View
        className="px-4 pt-2 pb-4 bg-white border-t border-slate-100"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <View className="flex-row items-end bg-slate-50 rounded-2xl px-4">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your jobs..."
            placeholderTextColor="#94A3B8"
            multiline
            className="flex-1 text-sm text-slate-900 py-3 max-h-24"
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            className="ml-2 mb-2.5 w-8 h-8 rounded-full items-center justify-center"
            style={{
              backgroundColor: input.trim() ? "#0F172A" : "#E2E8F0",
            }}
          >
            <FontAwesome
              name="arrow-up"
              size={14}
              color={input.trim() ? "#fff" : "#94A3B8"}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
