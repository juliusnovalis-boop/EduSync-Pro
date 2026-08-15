import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduSync Pro — Gestion scolaire",
  description:
    "Plateforme de gestion scolaire : élèves, enseignants, classes, notes, présences, bulletins, paiements, emplois du temps, QR codes, documents PDF et analyse IA.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
