import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View className="flex-1 items-center justify-center p-5 bg-gray-50">
        <Text className="text-lg font-bold text-gray-900">
          Screen not found
        </Text>
        <Link href="/" className="mt-4">
          <Text className="text-blue-500">Go home</Text>
        </Link>
      </View>
    </>
  );
}
