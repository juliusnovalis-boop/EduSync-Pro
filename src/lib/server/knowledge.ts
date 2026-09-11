/**
 * EduSync Knowledge - Types serveur partagés
 * Types et utilitaires pour la bibliotheque numerique scolaire.
 */

// =============================================================================
// ENUMS / TYPES DE DONNEES
// =============================================================================

/** Mode d'acces a une ressource */
export type AccessMode =
  | "read_in_edusync"
  | "download_in_edusync"
  | "open_external_source"
  | "request_access"
  | "unavailable";

/** Statut des droits d'une ressource */
export type RightsStatus =
  | "open_license"
  | "institution_license"
  | "public_domain"
  | "authorized"
  | "unknown"
  | "restricted";

/** Type de source d'une ressource */
export type SourceType =
  | "local_library"
  | "institutional"
  | "open_resource"
  | "external_library"
  | "external_search";

/** Portee d'une ressource (multi-tenant) */
export type Scope = "global" | "establishment" | "private";

/** Type de ressource pedagogique */
export type ResourceType =
  | "manual"
  | "guide"
  | "exam"
  | "worksheet"
  | "course"
  | "reference"
  | "article"
  | "video"
  | "other";

/** Niveau geographique */
export type GeoLevel = "gabon" | "afrique" | "international";

// =============================================================================
// VALIDATEURS
// =============================================================================

const ACCESS_MODES: AccessMode[] = [
  "read_in_edusync",
  "download_in_edusync",
  "open_external_source",
  "request_access",
  "unavailable",
];

const RIGHTS_STATUSES: RightsStatus[] = [
  "open_license",
  "institution_license",
  "public_domain",
  "authorized",
  "unknown",
  "restricted",
];

const SOURCE_TYPES: SourceType[] = [
  "local_library",
  "institutional",
  "open_resource",
  "external_library",
  "external_search",
];

const SCOPES: Scope[] = ["global", "establishment", "private"];

export function isAccessMode(value: string): value is AccessMode {
  return ACCESS_MODES.includes(value as AccessMode);
}

export function isRightsStatus(value: string): value is RightsStatus {
  return RIGHTS_STATUSES.includes(value as RightsStatus);
}

export function isSourceType(value: string): value is SourceType {
  return SOURCE_TYPES.includes(value as SourceType);
}

export function isScope(value: string): value is Scope {
  return SCOPES.includes(value as Scope);
}

// =============================================================================
// LABELS DISPLAY
// =============================================================================

export const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  read_in_edusync: "Lire dans EduSync",
  download_in_edusync: "Telecharger",
  open_external_source: "Ouvrir la source",
  request_access: "Demander l'acces",
  unavailable: "Indisponible",
};

export const RIGHTS_STATUS_LABELS: Record<RightsStatus, string> = {
  open_license: "Licence libre",
  institution_license: "Licence etablissement",
  public_domain: "Domaine public",
  authorized: "Autorise",
  unknown: "Droits a verifier",
  restricted: "Restreint",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  local_library: "Bibliotheque etablissement",
  institutional: "Institutionnel",
  open_resource: "Ressource libre",
  external_library: "Bibliotheque externe",
  external_search: "Recherche externe",
};

export const GEO_LEVEL_LABELS: Record<GeoLevel, string> = {
  gabon: "Gabon",
  afrique: "Afrique",
  international: "International",
};

// =============================================================================
// UTILITAIRES
// =============================================================================

export function needsRightsWarning(rightsStatus: RightsStatus): boolean {
  return rightsStatus === "unknown" || rightsStatus === "restricted";
}

export function canReadDirectly(accessMode: AccessMode): boolean {
  return accessMode === "read_in_edusync" || accessMode === "download_in_edusync";
}

export function canDownload(accessMode: AccessMode): boolean {
  return accessMode === "download_in_edusync";
}
