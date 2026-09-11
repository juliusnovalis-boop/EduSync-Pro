import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/** Écran de chargement : restauration de session au démarrage. */
export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>EduSync Pro — chargement…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" },
  text: { color: "#94a3b8", marginTop: 16, fontSize: 14 },
});
