"use client";

/**
 * Gestionnaire d'erreur au niveau segment - Minimal sans DB ni auth.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "50vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        gap: "1rem",
      }}
    >
      <h2 style={{ fontSize: "1.5rem" }}>Une erreur est survenue</h2>
      <p style={{ color: "#666" }}>Veuillez rafraîchir la page ou réessayer.</p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1rem",
          background: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "0.375rem",
          cursor: "pointer",
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
