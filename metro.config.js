const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ensure glb/gltf are treated as assets, not source files
config.resolver.sourceExts = config.resolver.sourceExts.filter(
  (ext) => ext !== "glb" && ext !== "gltf"
);
config.resolver.assetExts.push("glb", "gltf");

module.exports = withNativeWind(config, { input: "./global.css" });
