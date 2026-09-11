/**
 * EduSync Knowledge - Architecture extensible des sources de ressources documentaires.
 * Types et constantes pour les fournisseurs de ressources.
 */

export type SourceType = 
  | "institutional" 
  | "open_education" 
  | "school" 
  | "public" 
  | "external_catalog" 
  | "library" 
  | "archive";

export type AccessStatus = "global" | "establishment" | "private" | "external";

export type KnowledgeSourceType = 
  | "LOCAL_LIBRARY" 
  | "INSTITUTIONAL" 
  | "OPEN_RESOURCE" 
  | "EXTERNAL_LIBRARY" 
  | "EXTERNAL_SEARCH";

export type AccessMode = 
  | "READ_IN_EDUSYNC" 
  | "DOWNLOAD_IN_EDUSYNC" 
  | "OPEN_EXTERNAL_SOURCE" 
  | "REQUEST_ACCESS" 
  | "UNAVAILABLE";

export type RightsStatus = 
  | "OPEN_LICENSE" 
  | "INSTITUTION_LICENSE" 
  | "PUBLIC_DOMAIN" 
  | "AUTHORIZED" 
  | "UNKNOWN" 
  | "RESTRICTED";

export type KnowledgeScope = "GLOBAL" | "ESTABLISHMENT" | "PRIVATE";
export type GeoLevel = "gabon" | "afrique" | "international";
export type ResourceType = 
  | "textbook" 
  | "guide" 
  | "exercise" 
  | "exam" 
  | "course" 
  | "worksheet" 
  | "document" 
  | "audio" 
  | "video" 
  | "other";

export const RIGHTS_DISPLAY: Record<RightsStatus, { label: string; short: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  OPEN_LICENSE: { label: "Licence ouverte", short: "Licence ouverte", tone: "ok" },
  INSTITUTION_LICENSE: { label: "Licence etablissement", short: "Licence etablissement", tone: "ok" },
  PUBLIC_DOMAIN: { label: "Domaine public", short: "Domaine public", tone: "ok" },
  AUTHORIZED: { label: "Autorise", short: "Autorise", tone: "ok" },
  UNKNOWN: { label: "Droits a verifier", short: "A verifier", tone: "warn" },
  RESTRICTED: { label: "Droits restreints", short: "Restreint", tone: "danger" },
};

export const ACCESS_DISPLAY: Record<AccessMode, string> = {
  READ_IN_EDUSYNC: "Lire dans EduSync",
  DOWNLOAD_IN_EDUSYNC: "Telecharger dans EduSync",
  OPEN_EXTERNAL_SOURCE: "Ouvrir la source externe",
  REQUEST_ACCESS: "Demander acces",
  UNAVAILABLE: "Indisponible",
};

export const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  LOCAL_LIBRARY: "Bibliotheque de l etablissement",
  INSTITUTIONAL: "Source institutionnelle",
  OPEN_RESOURCE: "Ressource ouverte",
  EXTERNAL_LIBRARY: "Bibliotheque externe",
  EXTERNAL_SEARCH: "Recherche externe",
};

export const GEO_LEVELS: Record<GeoLevel, { label: string; flag: string }> = {
  gabon: { label: "Gabon", flag: "🇬🇦" },
  afrique: { label: "Afrique", flag: "🌍" },
  international: { label: "International", flag: "🌐" },
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  textbook: "Manuel scolaire",
  guide: "Guide enseignant",
  exercise: "Exercice",
  exam: "Examen / Evaluation",
  course: "Cours",
  worksheet: "Fiche de travail",
  document: "Document",
  audio: "Audio",
  video: "Video",
  other: "Autre",
};

export interface KnowledgeProvider {
  id: string;
  name: string;
  type: KnowledgeSourceType;
  baseUrl?: string;
  enabled: boolean;
  description?: string;
  rightsPolicy: "strict" | "permissive" | "unknown";
}

export const KNOWLEDGE_PROVIDERS: KnowledgeProvider[] = [
  { id: "educmad", name: "Mediatheque Educmad", type: "INSTITUTIONAL", baseUrl: "https://educmad.org", enabled: true, description: "Mediatheque educative du Gabon", rightsPolicy: "strict" },
  { id: "unesco-oer", name: "UNESCO OER", type: "OPEN_RESOURCE", baseUrl: "https://www.unesco.org/oer", enabled: true, description: "Ressources educatives libres de l UNESCO", rightsPolicy: "permissive" },
  { id: "openstax", name: "OpenStax", type: "OPEN_RESOURCE", baseUrl: "https://openstax.org", enabled: true, description: "Manuels ouverts gratuits", rightsPolicy: "permissive" },
  { id: "open-library", name: "Open Library", type: "EXTERNAL_LIBRARY", baseUrl: "https://openlibrary.org", enabled: true, description: "Bibliotheque numerique ouverte", rightsPolicy: "unknown" },
  { id: "internet-archive", name: "Internet Archive", type: "EXTERNAL_LIBRARY", baseUrl: "https://archive.org", enabled: true, description: "Archive numerique mondiale", rightsPolicy: "unknown" },
  { id: "annas-archive", name: "Anna s Archive", type: "EXTERNAL_SEARCH", baseUrl: "https://annas-archive.org", enabled: true, description: "Moteur de recherche de livres", rightsPolicy: "unknown" },
  { id: "library-genesis", name: "Library Genesis", type: "EXTERNAL_SEARCH", enabled: true, description: "Base de donnees de livres scientifiques", rightsPolicy: "unknown" },
  { id: "fomesoutra", name: "Fomesoutra", type: "EXTERNAL_LIBRARY", baseUrl: "https://fomesoutra.com", enabled: true, description: "Ressources educatives africaines", rightsPolicy: "unknown" },
  { id: "ebookradar", name: "eBookRadar", type: "EXTERNAL_SEARCH", enabled: true, description: "Recherche de livres electroniques", rightsPolicy: "unknown" },
  { id: "freebookspot", name: "FreeBookSpot", type: "EXTERNAL_SEARCH", baseUrl: "https://freebookspot.com", enabled: true, description: "Telechargement de livres gratuits", rightsPolicy: "unknown" },
  { id: "welib", name: "WeLib", type: "EXTERNAL_SEARCH", baseUrl: "https://welib.net", enabled: true, description: "Bibliotheque de livres", rightsPolicy: "unknown" },
  { id: "ebook-searcher", name: "eBook Searcher", type: "EXTERNAL_SEARCH", enabled: true, description: "Moteur de Recherche de livres", rightsPolicy: "unknown" },
];

export function getProviderById(id: string): KnowledgeProvider | undefined {
  return KNOWLEDGE_PROVIDERS.find(p => p.id === id);
}

export function getProvidersByType(type: KnowledgeSourceType): KnowledgeProvider[] {
  return KNOWLEDGE_PROVIDERS.filter(p => p.type === type && p.enabled);
}

export function getVerifiedProviders(): KnowledgeProvider[] {
  return KNOWLEDGE_PROVIDERS.filter(p => p.rightsPolicy !== "unknown" && p.enabled);
}

export function needsRightsVerification(providerId: string): boolean {
  const provider = getProviderById(providerId);
  return provider?.rightsPolicy === "unknown";
}

export interface KnowledgeResource {
  id: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  isbn?: string;
  publisher?: string;
  publication_year?: number;
  edition?: string;
  subject?: string;
  level?: string;
  class_level?: string;
  language?: string;
  country?: string;
  education_system?: string;
  curriculum?: string;
  description?: string;
  cover_url?: string;
  resource_type?: ResourceType;
  source_type: KnowledgeSourceType;
  source_name?: string;
  source_url?: string;
  external_id?: string;
  access_mode: AccessMode;
  rights_status: RightsStatus;
  license?: string;
  file_url?: string;
  scope: KnowledgeScope;
  school_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_verified_at?: string;
  status: "active" | "archived";
  geo_level?: GeoLevel;
}

export interface KnowledgeMetadata {
  subjects: string[];
  levels: string[];
  languages: string[];
  countries: string[];
  publishers: string[];
  years: number[];
}

export const DEFAULT_KNOWLEDGE_METADATA: KnowledgeMetadata = {
  subjects: ["Mathematiques","Francais","Sciences","Histoire-Geographie","Anglais","Physique-Chimie","SVT","Informatique","Economie","Philosophie","Musique","Arts","Education physique","Technologie","Sciences sociales","Langues africaines"],
  levels: ["Primaire","College","Lycee","Universite","Formation professionnelle"],
  languages: ["Francais","Anglais","Espagnol","Portugais","Lingala","Mpongwe","Fang"],
  countries: ["Gabon","France","Belgique","Senegal","Cote d Ivoire","Cameroun","Republique du Congo","RDC","Mali","Burkina Faso","Togo","Benin","Niger","Tchad","Canada","Suisse"],
  publishers: ["Editions Hatier","Editions Bordas","Editions Nathan","Editions Didier","Editions Magnard","Editions Hachette","Editions Lelivrescolaire","Editions Delagrave","Editions Foucher","Editions Vuibert","CNDP","ONEF","MINEDUB","MINESEC","MINESUP"],
  years: Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i),
};

/* --------- Constantes de formulaire (extensibles sans toucher au code central) --------- */

/** Matières scolaires (extensible). */
export const SUBJECTS: string[] = [
  "Mathématiques", "Français", "Anglais", "Histoire-Géographie", "Physique-Chimie",
  "SVT", "Informatique", "Économie", "Philosophie", "Biologie", "Éducation physique", "Autre",
];

/** Niveaux scolaires et classes/cycles associés. */
export const SCHOOL_LEVELS: { level: string; cycles: string[] }[] = [
  { level: "Maternelle", cycles: ["PS", "MS", "GS"] },
  { level: "Primaire", cycles: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"] },
  { level: "Collège", cycles: ["6e", "5e", "4e", "3e"] },
  { level: "Lycée", cycles: ["2nde", "1ère", "Tle"] },
  { level: "Université", cycles: ["Licence", "Master", "Doctorat"] },
  { level: "Formation professionnelle", cycles: ["Niveau 1", "Niveau 2", "Niveau 3"] },
];

/** Types de ressources documentaires. */
export const RESOURCE_TYPES: { value: string; label: string }[] = [
  { value: "textbook", label: "Manuel" },
  { value: "guide", label: "Guide enseignant" },
  { value: "document", label: "Document pédagogique" },
  { value: "exam", label: "Examen / annale" },
  { value: "exercise", label: "Exercices" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Vidéo" },
  { value: "other", label: "Autre" },
];
