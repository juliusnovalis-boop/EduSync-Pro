"use client";

import dynamic from "next/dynamic";

/** Coquille de chargement commune (SSR + hydratation). */
function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm">Chargement d'EduSync Pro…</p>
      </div>
    </div>
  );
}

/**
 * L'application EduSync Pro est une SPA (react-router) rendue côté client.
 * On la charge via next/dynamic avec ssr:false pour éviter toute évaluation
 * des modules navigateur (react-router, recharts, jspdf…) lors du SSR Next.
 */
const EduSyncApp = dynamic(() => import("@/spa/App"), {
  ssr: false,
  loading: () => <Splash />,
});

export default function SpaPage() {
  return <EduSyncApp />;
}
