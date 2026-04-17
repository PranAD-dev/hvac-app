import React from "react";
import { View, Image } from "react-native";

export default function GlassesViewer({ size = 220 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 16, overflow: "hidden" }}>
      <Image
        source={require("../assets/images/glasses.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}
