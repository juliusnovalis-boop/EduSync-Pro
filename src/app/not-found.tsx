"use client";

/**
 * Page 404 - Minimal sans DB ni auth.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "4rem", margin: 0, fontWeight: 700 }}>404</h1>
      <p style={{ fontSize: "1.25rem", color: "#666" }}>Page introuvable</p>
    </div>
  );
}
