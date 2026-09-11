// EduSync Tools Registry — source unique de vérité pour les outils
export type ToolCategory = "pdf" | "image" | "data" | "ai" | "audio_video";
export type ToolStatus = "available" | "coming_soon" | "beta";
export interface ToolRequirement {
    file?: boolean;
  text?: boolean;
  ai?: boolean;}
export interface ToolCapability {
    batch?: boolean;
  download?: boolean;
  preview?: boolean;
  external?: boolean;}
export interface ToolDefinition {
    id: string;
  name: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  icon: string;
  inputFormats?: string[];
  outputFormats?: string[];
  requirements?: ToolRequirement;
  capabilities?: ToolCapability;
  comingSoonReason?: string;}
export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; icon: string }> = {
    pdf: { label: "PDF & Documents", icon: "FileText" },  image: { label: "Images", icon: "Image" },  data: { label: "Données / Fichiers", icon: "Table" },  ai: { label: "IA Éducative", icon: "Sparkles" },  audio_video: { label: "Audio / Vidéo", icon: "AudioLines" },};
export const TOOLS: ToolDefinition[] = [  {
      id: "image-to-pdf", name: "Image vers PDF",    description: "Convertir une image (PNG/JPG/WEBP) en document PDF",    category: "pdf", status: "available", icon: "FileText",    inputFormats: ["image/png", "image/jpeg", "image/webp"],    outputFormats: ["application/pdf"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "merge-pdf", name: "Fusionner PDF",    description: "Combiner plusieurs fichiers PDF en un seul document",    category: "pdf", status: "coming_soon", icon: "FileStack",    requirements: { file: true },    comingSoonReason: "Nécessite pdf-lib (non installée) — jspdf ne permet pas de fusionner des PDF existants",  },  {
      id: "split-pdf", name: "Séparer PDF",    description: "Extraire des pages spécifiques d'un PDF",    category: "pdf", status: "coming_soon", icon: "FileStack",    requirements: { file: true },    comingSoonReason: "Nécessite pdf-lib (non installée)",  },  {
      id: "compress-pdf", name: "Compresser PDF",    description: "Réduire la taille d'un fichier PDF",    category: "pdf", status: "coming_soon", icon: "Minimize2",    requirements: { file: true },    comingSoonReason: "Nécessite un moteur PDF côté serveur ou pdf-lib",  },  {
      id: "rotate-pdf", name: "Pivoter PDF",    description: "Réorienter les pages d'un PDF",    category: "pdf", status: "coming_soon", icon: "RefreshCw",    requirements: { file: true },    comingSoonReason: "Nécessite pdf-lib (non installée)",  },  {
      id: "pdf-to-image", name: "PDF vers Image",    description: "Extraire chaque page du PDF en image",    category: "pdf", status: "coming_soon", icon: "Image",    requirements: { file: true },    comingSoonReason: "Nécessite pdf.js ou un moteur de rendu serveur",  },  {
      id: "pdf-to-word", name: "PDF vers Word",    description: "Convertir un PDF en document texte",    category: "pdf", status: "coming_soon", icon: "FileText",    requirements: { file: true },    comingSoonReason: "Conversion fidèle nécessite un moteur serveur",  },  {
      id: "pdf-to-excel", name: "PDF vers Excel",    description: "Extraire les tableaux d'un PDF",    category: "pdf", status: "coming_soon", icon: "Table",    requirements: { file: true },    comingSoonReason: "Nécessite un moteur d'extraction de tableaux",  },  {
      id: "ocr-pdf", name: "OCR PDF",    description: "Extraire le texte d'un PDF scanné",    category: "pdf", status: "coming_soon", icon: "ScanLine",    requirements: { file: true, ai: true },    comingSoonReason: "Nécessite un provider IA avec capacité vision",  },  {
      id: "compress-image", name: "Compresser Image",    description: "Réduire la taille d'une image (JPEG)",    category: "image", status: "available", icon: "Minimize2",    inputFormats: ["image/*"], outputFormats: ["image/jpeg"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "resize-image", name: "Redimensionner Image",    description: "Limiter la largeur/hauteur à 1280px max",    category: "image", status: "available", icon: "Image",    inputFormats: ["image/*"], outputFormats: ["image/jpeg"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "convert-image", name: "Convertir Image",    description: "Changer le format (PNG → JPG → WEBP)",    category: "image", status: "available", icon: "RefreshCw",    inputFormats: ["image/*"], outputFormats: ["image/png", "image/jpeg", "image/webp"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "qr-generator", name: "Générateur QR Code",    description: "Créer un QR code à partir d'un texte ou URL",    category: "image", status: "available", icon: "QrCode",    outputFormats: ["image/png"],    requirements: { text: true }, capabilities: { download: true },  },  {
      id: "crop-image", name: "Rogner une image",    description: "Extraire une zone rectangulaire d'une image",    category: "image", status: "available", icon: "Crop",    inputFormats: ["image/*"], outputFormats: ["image/png", "image/jpeg"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "rotate-image", name: "Pivoter une image",    description: "Faire pivoter une image de 90, 180 ou 270 degres",    category: "image", status: "available", icon: "RotateCw",    inputFormats: ["image/*"], outputFormats: ["image/png", "image/jpeg"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "flip-image", name: "Retourner une image",    description: "Retourner horizontalement ou verticalement",    category: "image", status: "available", icon: "FlipHorizontal",    inputFormats: ["image/*"], outputFormats: ["image/png", "image/jpeg"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "grayscale-image", name: "Noir & blanc",    description: "Convertir une image en niveaux de gris",    category: "image", status: "available", icon: "Palette",    inputFormats: ["image/*"], outputFormats: ["image/jpeg"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "add-border-image", name: "Bordure image",    description: "Ajouter une bordure colorée autour d'une image",    category: "image", status: "available", icon: "Square",    inputFormats: ["image/*"], outputFormats: ["image/png"],    requirements: { file: true, text: true }, capabilities: { download: true },  },  {
      id: "watermark-image", name: "Filigrane texte",    description: "Ajouter un texte en filigrane sur une image",    category: "image", status: "available", icon: "Type",    inputFormats: ["image/*"], outputFormats: ["image/png", "image/jpeg"],    requirements: { file: true, text: true }, capabilities: { download: true },  },  {
      id: "image-to-text", name: "Image vers texte (OCR)",    description: "Extraire le texte d'une image via IA",    category: "image", status: "coming_soon", icon: "ScanLine",    requirements: { file: true, ai: true },    comingSoonReason: "Nécessite un provider IA avec capacité vision (jsqr est limité aux codes QR)",  },  {
      id: "csv-to-excel", name: "CSV vers Excel",    description: "Convertir un CSV en tableur (.xls ouvrable dans Excel)",    category: "data", status: "beta", icon: "Table",    inputFormats: ["text/csv"], outputFormats: ["application/vnd.ms-excel"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "excel-to-csv", name: "Excel vers CSV",    description: "Extraire un CSV d'un fichier .xlsx",    category: "data", status: "coming_soon", icon: "FileSpreadsheet",    requirements: { file: true },    comingSoonReason: "Nécessite la bibliothèque xlsx (non installée) — ne pas faire file.text() sur du binaire XLSX",  },  {
      id: "json-to-csv", name: "JSON vers CSV",    description: "Convertir un tableau JSON en CSV",    category: "data", status: "available", icon: "FileJson",    inputFormats: ["application/json", "text/plain"],    outputFormats: ["text/csv"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "json-format", name: "Formater JSON",    description: "Formater et indenter un JSON",    category: "data", status: "available", icon: "FileJson",    inputFormats: ["application/json", "text/plain"],    outputFormats: ["application/json"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "json-validate", name: "Valider JSON",    description: "Valider la syntaxe d'un fichier JSON",    category: "data", status: "available", icon: "CheckCircle",    inputFormats: ["application/json", "text/plain"],    requirements: { file: true }, capabilities: { download: false },  },  {
      id: "csv-to-json", name: "CSV vers JSON",    description: "Convertir un CSV en tableau JSON",    category: "data", status: "available", icon: "FileJson",    inputFormats: ["text/csv"],    outputFormats: ["application/json"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "split-csv", name: "Diviser CSV",    description: "Diviser un CSV en plusieurs fichiers",    category: "data", status: "available", icon: "Split",    inputFormats: ["text/csv"],    outputFormats: ["text/csv"],    requirements: { file: true, text: true }, capabilities: { download: true },  },  {
      id: "clean-csv", name: "Nettoyer CSV",    description: "Supprimer les espaces et normaliser un CSV",    category: "data", status: "available", icon: "Eraser",    inputFormats: ["text/csv"],    outputFormats: ["text/csv"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "xml-to-json", name: "XML vers JSON",    description: "Convertir un fichier XML en JSON",    category: "data", status: "available", icon: "FileJson",    inputFormats: ["text/xml", "application/xml"],    outputFormats: ["application/json"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "xml-to-csv", name: "XML vers CSV",    description: "Convertir un XML tabulaire en CSV",    category: "data", status: "available", icon: "Table",    inputFormats: ["text/xml", "application/xml"],    outputFormats: ["text/csv"],    requirements: { file: true }, capabilities: { download: true },  },  {
      id: "ai-summarize", name: "Résumé IA",    description: "Générer un résumé structuré d'un texte",    category: "ai", status: "available", icon: "Sparkles",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-correct", name: "Correction",    description: "Corriger les fautes d'orthographe et grammaire",    category: "ai", status: "available", icon: "CheckCircle",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-rephrase", name: "Reformulation",    description: "Reformuler un texte de manière plus claire",    category: "ai", status: "available", icon: "RefreshCw",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-translate", name: "Traduction",    description: "Traduire un texte (français ↔ anglais)",    category: "ai", status: "available", icon: "Languages",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-questions", name: "Génération de questions",    description: "Créer des questions pédagogiques avec réponses",    category: "ai", status: "available", icon: "FileText",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-exercises", name: "Génération d'exercices",    description: "Créer des exercices avec corrigés",    category: "ai", status: "available", icon: "ClipboardList",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-revision", name: "Fiche de révision",    description: "Créer une fiche de révision structurée",    category: "ai", status: "available", icon: "GraduationCap",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-explanation", name: "Explication pédagogique",    description: "Expliquer un concept de manière claire et pédagogique",    category: "ai", status: "available", icon: "BookOpen",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-quiz", name: "Génération de quiz",    description: "Créer un quiz avec questions à choix multiples",    category: "ai", status: "available", icon: "HelpCircle",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-pedagogical-sheet", name: "Fiche pédagogique",    description: "Transformer un texte en fiche pédagogique structurée",    category: "ai", status: "available", icon: "FileText",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-simplify", name: "Simplification texte",    description: "Simplifier un texte pour un public jeune",    category: "ai", status: "available", icon: "Smile",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-lesson-plan", name: "Plan de cours",    description: "Générer un plan de cours structuré",    category: "ai", status: "available", icon: "Calendar",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "ai-exam", name: "Sujet d'évaluation",    description: "Générer un sujet d'évaluation avec corrigé",    category: "ai", status: "available", icon: "Edit",    requirements: { text: true, ai: true }, capabilities: { download: true },  },  {
      id: "transcribe-audio", name: "Audio vers texte",    description: "Transcrire un enregistrement audio en texte",    category: "audio_video", status: "coming_soon", icon: "Languages",    requirements: { file: true, ai: true },    comingSoonReason: "Nécessite un provider IA avec capacité transcription",  },];
export function getToolsByCategory(c: ToolCategory) { return TOOLS.filter((t) => t.category === c); }
export function getToolById(id: string) { return TOOLS.find((t) => t.id === id); }
export function searchTools(q: string) {
    const needle = q.toLowerCase();
  return TOOLS.filter((t) =>    t.name.toLowerCase().includes(needle) ||    t.description.toLowerCase().includes(needle) ||    t.id.toLowerCase().includes(needle)  );}
export function getAvailableTools() { return TOOLS.filter((t) => t.status === "available"); }
export function getComingSoonTools() { return TOOLS.filter((t) => t.status === "coming_soon"); }
