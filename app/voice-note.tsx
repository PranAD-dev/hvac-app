import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useJobStore } from "../store/jobStore";

const SERVER = "http://10.0.0.48:3001";
const NUM_BARS = 30;

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceNoteScreen() {
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const addNote = useJobStore((s) => s.addNote);
  const techName = useJobStore((s) => s.techName);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [meterValues, setMeterValues] = useState<number[]>(
    Array(NUM_BARS).fill(4)
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) setSelectedJobId(jobs[0].id);
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      const start = Date.now() - durationMs;
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - start);
      }, 200);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission Needed",
          "Microphone access is required to record voice notes."
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      rec.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && typeof status.metering === "number") {
          // metering is in dB, typically -160 to 0. Map to bar height.
          const db = status.metering;
          const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
          const height = 4 + normalized * 54;
          setMeterValues((prev) => {
            const next = [...prev];
            next.shift();
            next.push(height);
            return next;
          });
        }
      });
      rec.setProgressUpdateInterval(80);
      await rec.startAsync();

      setRecording(rec);
      setIsRecording(true);
      setTranscript("");
      setDurationMs(0);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Recording Failed", String(err));
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recording) return null;
    setIsRecording(false);
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
    } catch (err) {
      console.error("Stop failed", err);
    }
    setRecording(null);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    setMeterValues(Array(NUM_BARS).fill(4));
    return uri;
  };

  const transcribeAudio = async (uri: string) => {
    setTranscribing(true);
    try {
      const audio_base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await fetch(`${SERVER}/voice/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64,
          mime_type: "audio/m4a",
        }),
      });
      const data = await res.json();
      if (data.transcript) {
        setTranscript(data.transcript);
      } else {
        Alert.alert(
          "Transcription Failed",
          data.error || "Could not transcribe audio."
        );
      }
    } catch (err) {
      console.error("Transcribe error", err);
      Alert.alert(
        "Server Error",
        "Could not reach transcription server. Is it running?"
      );
    } finally {
      setTranscribing(false);
    }
  };

  const handleMicPress = async () => {
    if (isRecording) {
      const uri = await stopRecording();
      if (uri) await transcribeAudio(uri);
    } else {
      startRecording();
    }
  };

  const handleConfirm = async () => {
    if (isRecording) {
      const uri = await stopRecording();
      if (uri) await transcribeAudio(uri);
      return;
    }
    if (!transcript.trim()) {
      router.back();
      return;
    }
    if (!selectedJobId) {
      Alert.alert("No Job", "Create a job first before saving a note.");
      return;
    }
    setSaving(true);
    try {
      await addNote(selectedJobId, transcript.trim(), "manual", techName);
      router.back();
    } catch (err) {
      Alert.alert("Save Failed", String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (isRecording) await stopRecording();
    setTranscript("");
    setDurationMs(0);
    router.back();
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: "Voice Note",
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
            color: "#111827",
          },
          headerStyle: { backgroundColor: "#EFF6FF" },
          headerShadowVisible: false,
          headerTintColor: "#111827",
          headerLeft: () => (
            <Pressable
              onPress={handleDiscard}
              hitSlop={12}
              style={styles.headerBtn}
            >
              <FontAwesome name="chevron-left" size={16} color="#111827" />
            </Pressable>
          ),
          headerRight: () =>
            saving ? (
              <View style={styles.headerBtn}>
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            ) : (
              <Pressable
                onPress={handleConfirm}
                hitSlop={12}
                style={styles.headerBtn}
              >
                <FontAwesome name="save" size={16} color="#111827" />
              </Pressable>
            ),
        }}
      />
      <View style={styles.container}>
        {/* Job selector */}
        {jobs.length > 0 && (
          <Pressable
            onPress={() => setShowJobPicker(!showJobPicker)}
            style={styles.jobPill}
          >
            <FontAwesome name="user" size={11} color="#2563EB" />
            <Text style={styles.jobPillText} numberOfLines={1}>
              {selectedJob?.customer_name || "Pick a job"}
            </Text>
            <FontAwesome
              name={showJobPicker ? "chevron-up" : "chevron-down"}
              size={10}
              color="#2563EB"
            />
          </Pressable>
        )}

        {showJobPicker && (
          <ScrollView
            style={styles.jobPicker}
            contentContainerStyle={{ padding: 8 }}
          >
            {jobs.map((j) => (
              <Pressable
                key={j.id}
                onPress={() => {
                  setSelectedJobId(j.id);
                  setShowJobPicker(false);
                }}
                style={[
                  styles.jobPickerItem,
                  j.id === selectedJobId && styles.jobPickerItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.jobPickerItemText,
                    j.id === selectedJobId && { color: "#2563EB" },
                  ]}
                  numberOfLines={1}
                >
                  {j.customer_name}
                </Text>
                <Text style={styles.jobPickerItemAddr} numberOfLines={1}>
                  {j.customer_address}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Transcript Area */}
        <ScrollView
          style={styles.transcriptArea}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {transcribing ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={{ color: "#6B7280", marginTop: 8, fontSize: 14 }}>
                Transcribing...
              </Text>
            </View>
          ) : (
            <Text style={styles.transcriptText}>
              {transcript || (
                <Text style={{ color: "#9CA3AF" }}>
                  Tap the microphone to start recording...
                </Text>
              )}
            </Text>
          )}
        </ScrollView>

        {/* Waveform */}
        <View style={styles.waveformContainer}>
          {meterValues.map((h, i) => {
            const isActive = isRecording && i < NUM_BARS - 5;
            return (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: h,
                    backgroundColor: isActive ? "#3B82F6" : "#D1D5DB",
                    borderRadius: h > 8 ? 3 : 2,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Mic Button */}
        <View style={styles.micContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleMicPress}
              disabled={transcribing}
              style={styles.micButton}
            >
              <View
                style={[
                  styles.micInner,
                  isRecording && { backgroundColor: "#DC2626" },
                  transcribing && { backgroundColor: "#9CA3AF" },
                ]}
              >
                <FontAwesome
                  name={isRecording ? "stop" : "microphone"}
                  size={28}
                  color="#FFFFFF"
                />
              </View>
            </Pressable>
          </Animated.View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <Pressable onPress={handleConfirm} style={styles.controlButton}>
            <FontAwesome name="check" size={20} color="#374151" />
          </Pressable>

          <Text style={styles.timer}>{formatTime(durationMs)}</Text>

          <Pressable onPress={handleDiscard} style={styles.controlButton}>
            <FontAwesome name="times" size={20} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFF6FF" },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  jobPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
    marginTop: 16,
    maxWidth: "80%",
  },
  jobPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E3A5F",
    flexShrink: 1,
  },
  jobPicker: {
    marginTop: 10,
    marginHorizontal: 20,
    maxHeight: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
  },
  jobPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  jobPickerItemActive: { backgroundColor: "#DBEAFE" },
  jobPickerItemText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  jobPickerItemAddr: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  transcriptArea: {
    paddingHorizontal: 32,
    paddingTop: 24,
    minHeight: 140,
    maxHeight: 240,
  },
  transcriptText: {
    fontSize: 20,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
    lineHeight: 30,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    height: 80,
    gap: 2,
  },
  waveBar: { width: 4, minHeight: 4 },
  micContainer: { alignItems: "center", paddingBottom: 24, flex: 1, justifyContent: "center" },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(59,130,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  micInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 48,
    paddingBottom: 48,
    paddingTop: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  timer: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 1,
  },
});
