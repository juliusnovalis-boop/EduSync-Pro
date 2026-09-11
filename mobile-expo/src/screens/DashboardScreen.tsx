import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/client";

export default function DashboardScreen() {
  const { session, signOut } = useAuth();
  if (!session) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EduSync Pro</Text>
      <Text style={styles.subtitle}>Bienvenue 👋</Text>

      <View style={styles.card}>
        <Row label="Nom" value={session.name} />
        <Row label="Identifiant" value={session.loginId} />
        <Row label="Rôle" value={session.role} />
        <Row label="Environnement" value={session.environment} />
      </View>

      <Text style={styles.ok}>
        ✅ Connexion à l'API réussie ({api.apiUrl})
      </Text>

      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 80 },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 15, marginTop: 4, marginBottom: 24 },
  card: { backgroundColor: "#1e293b", borderRadius: 16, padding: 18 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  rowLabel: { color: "#94a3b8", fontSize: 14 },
  rowValue: { color: "#f8fafc", fontSize: 14, fontWeight: "600" },
  ok: { color: "#34d399", fontSize: 12, textAlign: "center", marginTop: 20 },
  button: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
