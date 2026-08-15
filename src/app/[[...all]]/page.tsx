import SpaPageClient from "./SpaPageClient";

/** Export statique (mobile/Capacitor) : toutes les routes sont générées à la volée. */
export function generateStaticParams() {
  return [
    { all: [] },
    { all: ["auth"] },
    { all: ["dashboard"] },
    { all: ["students"] },
    { all: ["teachers"] },
    { all: ["classes"] },
    { all: ["subjects"] },
    { all: ["grades"] },
    { all: ["ocr-grades"] },
    { all: ["attendance"] },
    { all: ["payments"] },
    { all: ["ranking"] },
    { all: ["bulletins"] },
    { all: ["timetable"] },
    { all: ["reports"] },
    { all: ["ia-analysis"] },
    { all: ["qr-center"] },
    { all: ["scanner"] },
    { all: ["qr-attendance"] },
    { all: ["document-studio"] },
    { all: ["student-cards"] },
    { all: ["print-center"] },
    { all: ["documents"] },
    { all: ["communication"] },
    { all: ["assignments"] },
    { all: ["calendar"] },
    { all: ["establishments"] },
    { all: ["access"] },
    { all: ["settings"] },
    { all: ["demo"] },
  ];
}

export default function Page() {
  return <SpaPageClient />;
}