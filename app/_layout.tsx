import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useJobStore } from "../store/jobStore";

import "../global.css";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const hydrate = useJobStore((s) => s.hydrate);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#1E3A5F",
        },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Tab" }} />
      <Stack.Screen
        name="job/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="job/automate/[id]"
        options={{
          title: "Automate",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="unit/[serial]"
        options={{
          title: "Unit History",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="story/[jobId]"
        options={{
          title: "Job Story",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="note/[jobId]/[noteId]"
        options={{
          title: "Note",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="notes/[jobId]"
        options={{
          title: "Notes",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="clips/[jobId]"
        options={{
          title: "Clips",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="tools"
        options={{
          title: "Tools",
          headerBackTitle: "Back",
        }}
      />
    </Stack>
  );
}
