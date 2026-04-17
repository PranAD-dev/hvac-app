import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { useJobStore } from "../../store/jobStore";
import { FontAwesome } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

const SERVER = "http://10.0.0.48:3001";

function SettingsRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5"
    >
      <View
        className="w-8 h-8 rounded-lg items-center justify-center"
        style={{ backgroundColor: iconColor + "14" }}
      >
        <FontAwesome name={icon} size={15} color={iconColor} />
      </View>
      <View className="flex-1 ml-3">
        <Text
          className="text-base font-medium"
          style={{ color: destructive ? "#DC2626" : "#0F172A" }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text className="text-xs text-slate-400 mt-0.5">{subtitle}</Text>
        )}
      </View>
      <View className="w-6 h-6 rounded-full bg-slate-100 items-center justify-center">
        <FontAwesome name="chevron-right" size={9} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { techName, setTechName, loadSeedData, clearAllData, jobs } =
    useJobStore();
  const [nameInput, setNameInput] = useState(techName);
  const [editing, setEditing] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  const [qbChecking, setQbChecking] = useState(true);
  const [jobberConnected, setJobberConnected] = useState(false);
  const [jobberChecking, setJobberChecking] = useState(true);

  useEffect(() => {
    checkQbStatus();
    checkJobberStatus();
  }, []);

  const checkQbStatus = async () => {
    setQbChecking(true);
    try {
      const res = await fetch(`${SERVER}/qb/status`);
      const data = await res.json();
      setQbConnected(data.connected);
    } catch {
      setQbConnected(false);
    }
    setQbChecking(false);
  };

  const handleConnectQB = async () => {
    try {
      const res = await fetch(`${SERVER}/qb/connect`);
      const data = await res.json();
      if (data.authUrl) {
        await WebBrowser.openBrowserAsync(data.authUrl);
        checkQbStatus();
      }
    } catch {
      Alert.alert(
        "Server Not Running",
        "Start the QuickBooks server first:\nnode scripts/quickbooks-server.js"
      );
    }
  };

  const handleDisconnectQB = () => {
    Alert.alert("Disconnect QuickBooks", "Remove your QuickBooks connection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${SERVER}/qb/disconnect`, { method: "POST" });
            setQbConnected(false);
          } catch {}
        },
      },
    ]);
  };

  const checkJobberStatus = async () => {
    setJobberChecking(true);
    try {
      const res = await fetch(`${SERVER}/jobber/status`);
      const data = await res.json();
      setJobberConnected(data.connected);
      setJobberChecking(false);
      return data.connected;
    } catch {
      setJobberConnected(false);
      setJobberChecking(false);
      return false;
    }
  };

  const syncJobberJobs = async () => {
    try {
      const res = await fetch(`${SERVER}/jobber/jobs`);
      const data = await res.json();
      if (data.jobs && data.jobs.length > 0) {
        await useJobStore.getState().syncJobberJobs(data.jobs);
      }
    } catch {}
  };

  const handleConnectJobber = async () => {
    try {
      const res = await fetch(`${SERVER}/jobber/connect`);
      const data = await res.json();
      if (data.redirectUrl) {
        await WebBrowser.openBrowserAsync(data.redirectUrl);
        const isConnected = await checkJobberStatus();
        if (isConnected) {
          await syncJobberJobs();
          Alert.alert("Jobber Connected", "Your jobs have been synced.");
        }
      }
    } catch {
      Alert.alert(
        "Server Not Running",
        "Start the server first:\ncd server && node index.js"
      );
    }
  };

  const handleDisconnectJobber = () => {
    Alert.alert("Disconnect Jobber", "Remove your Jobber connection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: () => setJobberConnected(false),
      },
    ]);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setTechName(nameInput.trim());
    }
    setEditing(false);
  };

  const handleLoadSeed = () => {
    Alert.alert(
      "Load Sample Data",
      "This will replace all current jobs with 8 realistic HVAC sample jobs. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load",
          onPress: () => {
            loadSeedData();
            Alert.alert("Done", "8 sample jobs loaded.");
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "This will delete all jobs. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: () => {
            clearAllData();
            Alert.alert("Done", "All job data cleared.");
          },
        },
      ]
    );
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(jobs, null, 2);
    Alert.alert(
      "Export Data",
      `${jobs.length} jobs ready to export (${(dataStr.length / 1024).toFixed(1)} KB). In production, this would save to a file or share sheet.`
    );
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Technician */}
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mx-5 mt-6 mb-2">
        Technician
      </Text>
      <View className="bg-white mx-4 rounded-2xl overflow-hidden"
        style={{
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <View className="flex-row items-center px-4 py-4">
          <View className="w-10 h-10 rounded-full bg-slate-900 items-center justify-center">
            <Text className="text-white font-bold text-sm">
              {techName.split(" ").map((n) => n[0]).join("")}
            </Text>
          </View>
          {editing ? (
            <View className="flex-1 flex-row items-center ml-3">
              <TextInput
                className="flex-1 text-base text-slate-900 bg-slate-100 px-3 py-2 rounded-xl"
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                onSubmitEditing={handleSaveName}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleSaveName}
                className="ml-2 bg-slate-900 px-4 py-2 rounded-xl"
              >
                <Text className="text-sm font-bold text-white">Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditing(true)}
              className="flex-1 flex-row items-center justify-between ml-3"
            >
              <View>
                <Text className="text-base font-semibold text-slate-900">
                  {techName}
                </Text>
                <Text className="text-xs text-slate-400">Tap to edit</Text>
              </View>
              <View className="w-7 h-7 bg-slate-100 rounded-full items-center justify-center">
                <FontAwesome name="pencil" size={11} color="#94A3B8" />
              </View>
            </Pressable>
          )}
        </View>
      </View>

      {/* Data Management */}
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mx-5 mt-7 mb-2">
        Data
      </Text>
      <View className="bg-white mx-4 rounded-2xl overflow-hidden"
        style={{
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <SettingsRow
          icon="database"
          iconColor="#2563EB"
          title="Load Sample Data"
          subtitle="Load 8 realistic HVAC demo jobs"
          onPress={handleLoadSeed}
        />
        <View className="h-px bg-slate-100 mx-4" />
        <SettingsRow
          icon="download"
          iconColor="#16A34A"
          title="Export All Data"
          subtitle={`${jobs.length} jobs stored locally`}
          onPress={handleExportJSON}
        />
        <View className="h-px bg-slate-100 mx-4" />
        <SettingsRow
          icon="trash-o"
          iconColor="#DC2626"
          title="Clear All Data"
          subtitle="Delete all job data from device"
          onPress={handleClearData}
          destructive
        />
      </View>

      {/* Integrations */}
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mx-5 mt-7 mb-2">
        Integrations
      </Text>
      <View
        className="bg-white mx-4 rounded-2xl overflow-hidden"
        style={{
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        {/* QuickBooks */}
        <View className="flex-row items-center px-4 py-4">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: qbConnected ? "#16A34A14" : "#2563EB14" }}
          >
            <FontAwesome
              name="book"
              size={18}
              color={qbConnected ? "#16A34A" : "#2563EB"}
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-slate-900">
              QuickBooks Online
            </Text>
            <View className="flex-row items-center mt-0.5">
              <View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{
                  backgroundColor: qbChecking
                    ? "#CA8A04"
                    : qbConnected
                    ? "#16A34A"
                    : "#94A3B8",
                }}
              />
              <Text className="text-xs text-slate-400">
                {qbChecking
                  ? "Checking..."
                  : qbConnected
                  ? "Connected"
                  : "Not connected"}
              </Text>
            </View>
          </View>
          {qbConnected ? (
            <Pressable
              onPress={handleDisconnectQB}
              className="px-4 py-2 rounded-xl bg-slate-100"
            >
              <Text className="text-xs font-bold text-slate-600">
                Disconnect
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleConnectQB}
              className="px-4 py-2 rounded-xl"
              style={{ backgroundColor: "#2563EB" }}
            >
              <Text className="text-xs font-bold text-white">Connect</Text>
            </Pressable>
          )}
        </View>

        <View className="h-px bg-slate-100 mx-4" />

        {/* Jobber */}
        <View className="flex-row items-center px-4 py-4">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: "#16A34A14" }}
          >
            <FontAwesome
              name="calendar-check-o"
              size={18}
              color="#16A34A"
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-slate-900">
              Jobber
            </Text>
            <View className="flex-row items-center mt-0.5">
              <View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{
                  backgroundColor: jobberChecking
                    ? "#CA8A04"
                    : jobberConnected
                    ? "#16A34A"
                    : "#94A3B8",
                }}
              />
              <Text className="text-xs text-slate-400">
                {jobberChecking
                  ? "Checking..."
                  : jobberConnected
                  ? "Connected — jobs auto-synced"
                  : "Not connected"}
              </Text>
            </View>
          </View>
          {jobberConnected ? (
            <Pressable
              onPress={handleDisconnectJobber}
              className="px-4 py-2 rounded-xl bg-slate-100"
            >
              <Text className="text-xs font-bold text-slate-600">
                Disconnect
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleConnectJobber}
              className="px-4 py-2 rounded-xl"
              style={{ backgroundColor: "#16A34A" }}
            >
              <Text className="text-xs font-bold text-white">Connect</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Connected Glasses */}
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mx-5 mt-7 mb-2">
        Connected Glasses
      </Text>
      <View className="bg-white mx-4 rounded-2xl overflow-hidden"
        style={{
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <View className="flex-row items-center px-4 py-4">
          <View className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center">
            <FontAwesome name="bluetooth-b" size={15} color="#94A3B8" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-base text-slate-400">No glasses paired</Text>
            <Text className="text-xs text-slate-300 mt-0.5">
              Bluetooth pairing available in production
            </Text>
          </View>
        </View>
      </View>

      {/* App info */}
      <View className="items-center mt-10 mb-12">
        <Text className="text-xs font-semibold text-slate-300">
          HVAC Smart Glasses Companion
        </Text>
        <Text className="text-xs text-slate-300 mt-1">Prototype v1.0</Text>
      </View>
    </ScrollView>
  );
}
