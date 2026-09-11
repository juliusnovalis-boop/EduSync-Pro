"use client";

/**
 * Gestionnaire d'erreur global - Next.js 13+ App Router.
 * Minimal : PAS de DB, PAS d'auth, PAS de cookies/headers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Une erreur est survenue</h1>
        <p style={{ color: "#666", marginBottom: "1rem" }}>Veuillez rafraîchir la page.</p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            background: "#13131c",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
