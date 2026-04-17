import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, TextInput, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome } from "@expo/vector-icons";
import { useJobStore } from "../../../store/jobStore";

type Recipient = "client" | "manager" | "both";

type AutomationConfig = {
  sendReport: boolean;
  reportRecipient: Recipient;
  sendInvoice: boolean;
  quickbooksConnected: boolean;
  invoiceAmount: string;
};

const DEFAULTS: AutomationConfig = {
  sendReport: true,
  reportRecipient: "both",
  sendInvoice: true,
  quickbooksConnected: false,
  invoiceAmount: "",
};

const storageKey = (id: string) => `automation_${id}`;

export default function AutomateJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { jobs } = useJobStore();
  const job = jobs.find((j) => j.id === id);

  const [config, setConfig] = useState<AutomationConfig>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(storageKey(id)).then((raw) => {
      if (raw) {
        try {
          setConfig({ ...DEFAULTS, ...JSON.parse(raw) });
        } catch {}
      }
      setHydrated(true);
    });
  }, [id]);

  useEffect(() => {
    if (!hydrated || !id) return;
    AsyncStorage.setItem(storageKey(id), JSON.stringify(config));
  }, [config, hydrated, id]);

  if (!job) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-slate-400">Job not found</Text>
      </View>
    );
  }

  const update = <K extends keyof AutomationConfig>(key: K, value: AutomationConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const handleConnectQuickBooks = () => {
    Alert.alert(
      "Connect QuickBooks",
      "This will open the QuickBooks OAuth flow to authorize invoice creation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Connect",
          onPress: () => update("quickbooksConnected", true),
        },
      ]
    );
  };

  const handleSimulate = () => {
    const steps: string[] = [];
    steps.push('Glasses signal: "Job done" detected');
    if (config.sendReport) {
      const who =
        config.reportRecipient === "both"
          ? "client + manager"
          : config.reportRecipient;
      steps.push(`Generate service report → send to ${who}`);
    }
    if (config.sendInvoice) {
      if (config.quickbooksConnected) {
        steps.push(
          `Create QuickBooks invoice${config.invoiceAmount ? ` ($${config.invoiceAmount})` : ""}`
        );
      } else {
        steps.push("⚠ QuickBooks not connected — invoice skipped");
      }
    }
    Alert.alert("Automation Preview", steps.join("\n\n"));
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header */}
      <View className="bg-white px-5 pt-5 pb-4 border-b border-slate-100">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Automating
        </Text>
        <Text className="text-xl font-bold text-slate-900 mt-1">{job.customer_name}</Text>
        <Text className="text-sm text-slate-500 mt-0.5" numberOfLines={1}>
          {job.customer_address}
        </Text>
      </View>

      {/* Trigger */}
      <View className="mx-4 mt-5">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">
          Trigger
        </Text>
        <View className="bg-white rounded-2xl p-4 flex-row items-center">
          <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: "#1E3A5F" }}>
            <FontAwesome name="microphone" size={16} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-slate-900">Glasses: "Job done"</Text>
            <Text className="text-xs text-slate-500 mt-0.5">
              Fires when the tech says "job done" into the glasses
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <Text className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-6 mb-2 mx-5">
        When triggered
      </Text>

      {/* Service Report card */}
      <View className="mx-4 bg-white rounded-2xl p-5 mb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
              <FontAwesome name="file-text-o" size={16} color="#1E3A5F" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-900">Send service report</Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                Auto-generate and email the report
              </Text>
            </View>
          </View>
          <Switch
            value={config.sendReport}
            onValueChange={(v) => update("sendReport", v)}
            trackColor={{ true: "#1E3A5F", false: "#CBD5E1" }}
          />
        </View>

        {config.sendReport && (
          <View className="mt-4 pt-4 border-t border-slate-100">
            <Text className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Send to
            </Text>
            <View className="flex-row gap-2">
              {(["client", "manager", "both"] as Recipient[]).map((r) => {
                const active = config.reportRecipient === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => update("reportRecipient", r)}
                    className="flex-1 py-2.5 rounded-xl items-center"
                    style={{
                      backgroundColor: active ? "#1E3A5F" : "#F1F5F9",
                    }}
                  >
                    <Text
                      className="text-xs font-bold capitalize"
                      style={{ color: active ? "#fff" : "#64748B" }}
                    >
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Invoice card */}
      <View className="mx-4 bg-white rounded-2xl p-5 mb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-10 h-10 rounded-xl bg-green-50 items-center justify-center mr-3">
              <FontAwesome name="dollar" size={16} color="#16A34A" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-900">Send invoice</Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                Create invoice via QuickBooks
              </Text>
            </View>
          </View>
          <Switch
            value={config.sendInvoice}
            onValueChange={(v) => update("sendInvoice", v)}
            trackColor={{ true: "#16A34A", false: "#CBD5E1" }}
          />
        </View>

        {config.sendInvoice && (
          <View className="mt-4 pt-4 border-t border-slate-100">
            {config.quickbooksConnected ? (
              <View className="flex-row items-center bg-green-50 rounded-xl px-3 py-2.5 mb-3">
                <FontAwesome name="check-circle" size={14} color="#16A34A" />
                <Text className="text-xs font-semibold text-green-700 ml-2">
                  QuickBooks connected
                </Text>
                <Pressable
                  onPress={() => update("quickbooksConnected", false)}
                  className="ml-auto"
                >
                  <Text className="text-xs text-slate-500 underline">Disconnect</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleConnectQuickBooks}
                className="rounded-xl px-4 py-3 mb-3 flex-row items-center justify-center"
                style={{ backgroundColor: "#2CA01C" }}
              >
                <FontAwesome name="link" size={13} color="#fff" />
                <Text className="text-sm font-bold text-white ml-2">
                  Connect QuickBooks
                </Text>
              </Pressable>
            )}

            <Text className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Amount (optional)
            </Text>
            <View className="flex-row items-center bg-slate-100 rounded-xl px-3">
              <Text className="text-slate-500 text-base mr-1">$</Text>
              <TextInput
                value={config.invoiceAmount}
                onChangeText={(v) => update("invoiceAmount", v.replace(/[^0-9.]/g, ""))}
                placeholder="Auto from report"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                className="flex-1 py-3 text-base text-slate-900"
              />
            </View>
          </View>
        )}
      </View>

      {/* Test button */}
      <Pressable
        onPress={handleSimulate}
        className="mx-4 mt-4 rounded-2xl py-4 items-center"
        style={{ backgroundColor: "#0F172A" }}
      >
        <View className="flex-row items-center">
          <FontAwesome name="play-circle" size={15} color="#fff" />
          <Text className="text-white font-bold text-sm ml-2">Preview automation</Text>
        </View>
      </Pressable>

      <Text className="text-xs text-slate-400 text-center mx-8 mt-4">
        Settings are saved automatically. Automation will run the next time the glasses report
        this job as done.
      </Text>
    </ScrollView>
  );
}
