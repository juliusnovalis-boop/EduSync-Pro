import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/server/db";
import { aiGuard } from "@/lib/server/ai-guard";
import { canManageKnowledge, canReadKnowledge, PERMISSIONS } from "@/lib/server/rbac";
import { randomUUID } from "node:crypto";
import { eq, and, or, ilike } from "drizzle-orm";

// Types
export type AccessMode = "READ_IN_EDUSYNC" | "DOWNLOAD_IN_EDUSYNC" | "OPEN_EXTERNAL_SOURCE" | "REQUEST_ACCESS" | "UNAVAILABLE";
export type RightsStatus = "OPEN_LICENSE" | "INSTITUTION_LICENSE" | "PUBLIC_DOMAIN" | "AUTHORIZED" | "UNKNOWN" | "RESTRICTED";
export type ResourceScope = "GLOBAL" | "ESTABLISHMENT" | "PRIVATE";
export type ResourceStatus = "active" | "archived";
export type SourceType = "LOCAL_LIBRARY" | "INSTITUTIONAL" | "OPEN_RESOURCE" | "EXTERNAL_LIBRARY" | "EXTERNAL_SEARCH";
export type ResourceType = "textbook" | "guide" | "document" | "exam" | "exercise" | "audio" | "video" | "other";

export interface KnowledgeResource {
  id: string;
  title: string;
  subtitle?: string;
  authors?: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
  edition?: string;
  subject?: string;
  level?: string;
  classLevel?: string;
  language?: string;
  country?: string;
  educationSystem?: string;
  curriculum?: string;
  description?: string;
  coverUrl?: string;
  resourceType: ResourceType;
  sourceType: SourceType;
  sourceName?: string;
  sourceUrl?: string;
  externalId?: string;
  accessMode: AccessMode;
  rightsStatus: RightsStatus;
  license?: string;
  fileUrl?: string;
  scope: ResourceScope;
  schoolId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
  status: ResourceStatus;
}

export interface KnowledgeSearchParams {
  query?: string;
  subject?: string;
  level?: string;
  classLevel?: string;
  language?: string;
  country?: string;
  sourceType?: SourceType;
  sourceName?: string;
  rightsStatus?: RightsStatus;
  accessMode?: AccessMode;
  scope?: ResourceScope;
  schoolId?: string;
  region?: "gabon" | "africa" | "international";
  page?: number;
  limit?: number;
}

// Catalogue de référence
const REFERENCE_CATALOG: KnowledgeResource[] = [
  {
    id: "ref-gabon-001",
    title: "Mathématiques 6e - Programme Gabon",
    authors: "Ministère de l'Éducation Nationale du Gabon",
    publisher: "Édition Nationale Gabon",
    publicationYear: 2019,
    subject: "Mathématiques",
    level: "Collège",
    classLevel: "6e",
    language: "Français",
    country: "Gabon",
    educationSystem: "Gabon",
    description: "Manuel de mathématiques pour la classe de 6e du système éducatif gabonais.",
    resourceType: "textbook",
    sourceType: "INSTITUTIONAL",
    sourceName: "Ministère de l'Éducation Gabon",
    sourceUrl: "https://www.education.gouv.ga",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "PUBLIC_DOMAIN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-gabon-002",
    title: "Français 6e - Programme Gabon",
    authors: "Ministère de l'Éducation Nationale du Gabon",
    publisher: "Édition Nationale Gabon",
    publicationYear: 2019,
    subject: "Français",
    level: "Collège",
    classLevel: "6e",
    language: "Français",
    country: "Gabon",
    educationSystem: "Gabon",
    description: "Manuel de français pour la classe de 6e du système éducatif gabonais.",
    resourceType: "textbook",
    sourceType: "INSTITUTIONAL",
    sourceName: "Ministère de l'Éducation Gabon",
    sourceUrl: "https://www.education.gouv.ga",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "PUBLIC_DOMAIN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-africa-001",
    title: "Sciences de la Vie et de la Terre - Lycée",
    authors: "UNESCO",
    publisher: "UNESCO",
    publicationYear: 2020,
    subject: "SVT",
    level: "Lycée",
    language: "Français",
    country: "International",
    description: "Ressource éducative sur les sciences de la vie et de la terre pour les établissements africains.",
    resourceType: "textbook",
    sourceType: "OPEN_RESOURCE",
    sourceName: "UNESCO OER",
    sourceUrl: "https://www.unesco.org",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "OPEN_LICENSE",
    license: "CC BY-NC-SA 4.0",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-africa-002",
    title: "Mathématiques pour le Collège - Afrique francophone",
    authors: "Banque Mondiale / PADEP",
    publisher: "Banque Mondiale",
    publicationYear: 2021,
    subject: "Mathématiques",
    level: "Collège",
    language: "Français",
    country: "International",
    description: "Collection de mathématiques adaptée au contexte africain francophone.",
    resourceType: "textbook",
    sourceType: "OPEN_RESOURCE",
    sourceName: "Banque Mondiale - PADEP",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "OPEN_LICENSE",
    license: "CC BY 4.0",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-intl-001",
    title: "OpenStax Biology 2e",
    authors: "OpenStax",
    publisher: "OpenStax",
    publicationYear: 2022,
    subject: "Biologie",
    level: "Université",
    language: "Anglais",
    country: "États-Unis",
    description: "Manuel de biologie complet disponible en open access.",
    resourceType: "textbook",
    sourceType: "OPEN_RESOURCE",
    sourceName: "OpenStax",
    sourceUrl: "https://openstax.org",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "OPEN_LICENSE",
    license: "CC BY 4.0",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-intl-002",
    title: "OpenStax Calculus Volume 1",
    authors: "OpenStax",
    publisher: "OpenStax",
    publicationYear: 2022,
    subject: "Mathématiques",
    level: "Université",
    language: "Anglais",
    country: "États-Unis",
    description: "Calcul différentiel et intégral - Volume 1, open access.",
    resourceType: "textbook",
    sourceType: "OPEN_RESOURCE",
    sourceName: "OpenStax",
    sourceUrl: "https://openstax.org",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "OPEN_LICENSE",
    license: "CC BY 4.0",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-ext-001",
    title: "Collection de manuels scolaires",
    authors: "Various",
    subject: "Various",
    level: "Multi-niveaux",
    resourceType: "textbook",
    sourceType: "EXTERNAL_LIBRARY",
    sourceName: "Open Library",
    sourceUrl: "https://openlibrary.org",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "UNKNOWN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-ext-002",
    title: "Archive de documents éducatifs",
    resourceType: "document",
    sourceType: "EXTERNAL_LIBRARY",
    sourceName: "Internet Archive",
    sourceUrl: "https://archive.org",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "UNKNOWN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-annas-001",
    title: "Ressources diverses",
    resourceType: "textbook",
    sourceType: "EXTERNAL_SEARCH",
    sourceName: "Anna's Archive",
    sourceUrl: "https://annas-archive.org",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "UNKNOWN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-libgen-001",
    title: "Base de données documentaire",
    resourceType: "textbook",
    sourceType: "EXTERNAL_SEARCH",
    sourceName: "Library Genesis",
    sourceUrl: "https://libgen.is",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "UNKNOWN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-educmad-001",
    title: "Ressources pédagogiques Madagascar",
    authors: "Médiathèque Educmad",
    publisher: "Educmad",
    subject: "Various",
    language: "Français",
    country: "Madagascar",
    description: "Base de ressources pédagogiques pour l'éducation à Madagascar.",
    resourceType: "document",
    sourceType: "INSTITUTIONAL",
    sourceName: "Médiathèque Educmad",
    sourceUrl: "https://educmad.org",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "UNKNOWN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
  {
    id: "ref-fomesoutra-001",
    title: "Ressources éducatives Côte d'Ivoire",
    authors: "Fomesoutra",
    publisher: "Fomesoutra",
    subject: "Various",
    language: "Français",
    country: "Côte d'Ivoire",
    description: "Plateforme éducative ivoirienne avec cours et exercices.",
    resourceType: "document",
    sourceType: "INSTITUTIONAL",
    sourceName: "Fomesoutra",
    sourceUrl: "https://fomesoutra.com",
    accessMode: "OPEN_EXTERNAL_SOURCE",
    rightsStatus: "UNKNOWN",
    scope: "GLOBAL",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "active",
  },
];

/** Format KnowledgePage : snake_case + origin + geo_level. */
function geoFromCountry(r: KnowledgeResource): "gabon" | "afrique" | "international" {
  const c = `${r.country ?? ""} ${r.educationSystem ?? ""}`.toLowerCase();
  if (c.includes("gabon")) return "gabon";
  const africa = ["cameroun", "congo", "sénégal", "senegal", "côte d'ivoire", "cote d'ivoire", "madagascar", "afrique", "togo", "bénin", "benin", "mali", "nigeria", "guinée", "tchad", "centrafrique", "niger", "burkina"];
  if (africa.some((a) => c.includes(a))) return "afrique";
  return "international";
}

function toKnowledgeItem(r: KnowledgeResource, origin: "local" | "reference") {
  return {
    id: r.id, title: r.title, subtitle: r.subtitle ?? null,
    authors: r.authors ? [r.authors] : [], isbn: r.isbn ?? null, publisher: r.publisher ?? null,
    publication_year: r.publicationYear ?? null, edition: r.edition ?? null,
    subject: r.subject ?? null, level: r.level ?? null, class: r.classLevel ?? null,
    language: r.language || "fr", country: r.country ?? null, geo_level: geoFromCountry(r),
    description: r.description ?? null, cover_url: r.coverUrl ?? null,
    resource_type: r.resourceType ?? "other", source: r.sourceName || "—", source_id: r.sourceName || "",
    source_type: r.sourceType || "EXTERNAL_LIBRARY", source_url: r.sourceUrl ?? null,
    external_id: r.externalId ?? null, license: r.license ?? null,
    rights_status: r.rightsStatus || "UNKNOWN", access_status: r.accessMode || "UNAVAILABLE",
    scope: r.scope || "GLOBAL", school_id: r.schoolId ?? null, status: r.status || "active",
    file_url: r.fileUrl ?? null, created_by: r.createdBy ?? null,
    created_at: r.createdAt ?? null, updated_at: r.updatedAt ?? null, origin,
  };
}

/** Normalise un payload frontend (accepte snake_case et camelCase). */
function normBody(body: Record<string, unknown>): Partial<KnowledgeResource> {
  const out: Record<string, unknown> = { ...body };
  const map: Record<string, string> = {
    publication_year: "publicationYear", class_level: "classLevel", education_system: "educationSystem",
    cover_url: "coverUrl", resource_type: "resourceType", source_type: "sourceType",
    source_name: "sourceName", source_url: "sourceUrl", external_id: "externalId",
    access_mode: "accessMode", access_status: "accessMode", rights_status: "rightsStatus",
    file_url: "fileUrl", school_id: "schoolId", created_by: "createdBy", last_verified_at: "lastVerifiedAt",
  };
  for (const [snake, camel] of Object.entries(map)) {
    if (snake in out && !(camel in out)) out[camel] = out[snake];
    if (snake in out) delete out[snake];
  }
  // authors : accepte string ou string[] → string (colonne text)
  if (Array.isArray(out.authors)) out.authors = (out.authors as unknown[]).filter((a) => typeof a === "string").join(", ");
  return out as Partial<KnowledgeResource>;
}

// GET - Liste / Recherche (renvoie { items } au format snake_case attendu par KnowledgePage)
export async function GET(request: NextRequest) {
  try {
    const guard = await aiGuard(request, PERMISSIONS.KNOWLEDGE_READ, "knowledge", "read");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const session = {
      role: guard.ctx.role,
      user: { id: guard.ctx.userId, role: guard.ctx.role, schoolId: guard.ctx.schoolId ?? undefined },
      schoolId: guard.ctx.schoolId,
    };

    const { searchParams } = new URL(request.url);
    // Alias acceptes : q, access, geo, rights, source_type
    const params = parseSearchParams(searchParams);
    params.query = searchParams.get("q") || params.query;
    params.accessMode = (searchParams.get("access") as AccessMode) || params.accessMode;
    params.rightsStatus = (searchParams.get("rights") as RightsStatus) || params.rightsStatus;
    params.sourceType = (searchParams.get("source_type") as SourceType) || params.sourceType;
    params.region = (searchParams.get("geo") as "gabon" | "africa" | "international") || params.region;

    let dbResources: KnowledgeResource[] = [];
    try {
      const rows = await db
        .select()
        .from(schema.knowledgeResources)
        .where(buildWhereClause(params, session))
        .limit(params.limit || 50);
      dbResources = rows.map(rowToResource);
    } catch (dbError) {
      console.warn("Base knowledge_resources non disponible:", dbError);
    }

    let refResources = REFERENCE_CATALOG.filter(r => r.status === "active");
    if (params.region === "gabon") {
      refResources = refResources.filter(r => r.country === "Gabon" || r.educationSystem === "Gabon");
    } else if (params.region === "africa") {
      refResources = refResources.filter(r =>
        r.country === "Gabon" || r.country === "Madagascar" || r.country === "Côte d'Ivoire" ||
        r.educationSystem === "Gabon" || r.country === "International"
      );
    }
    if (params.query) {
      const q = params.query.toLowerCase();
      refResources = refResources.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.authors?.toLowerCase().includes(q) ||
        r.isbn?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q) ||
        r.publisher?.toLowerCase().includes(q)
      );
    }
    if (params.subject) refResources = refResources.filter(r => r.subject === params.subject);
    if (params.level) refResources = refResources.filter(r => r.level === params.level);
    if (params.language) refResources = refResources.filter(r => r.language === params.language);
    if (params.sourceName) refResources = refResources.filter(r => r.sourceName === params.sourceName);
    if (params.sourceType) refResources = refResources.filter(r => r.sourceType === params.sourceType);
    if (params.rightsStatus) refResources = refResources.filter(r => r.rightsStatus === params.rightsStatus);

    const all = [...dbResources.map(r => toKnowledgeItem(r, "local")), ...refResources.map(r => toKnowledgeItem(r, "reference"))];
    const items = all.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);

    return NextResponse.json({ items, total: items.length, page: params.page || 1, limit: params.limit || 50 });
  } catch (error) {
    console.error("Erreur GET /api/knowledge:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
// POST - Créer une ressource
export async function POST(request: NextRequest) {
  try {
    const guard = await aiGuard(request, PERMISSIONS.KNOWLEDGE_MANAGE, "knowledge", "manage");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const session = {
      role: guard.ctx.role,
      user: { id: guard.ctx.userId, role: guard.ctx.role, schoolId: guard.ctx.schoolId ?? undefined },
      schoolId: guard.ctx.schoolId,
    };

    const body = normBody((await request.json()) as Record<string, unknown>);

    if (!body.title || !body.resourceType || !body.accessMode) {
      return NextResponse.json(
        { error: "Champs requis: title, resourceType, accessMode" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = randomUUID();

    // school_id vient du serveur (session), jamais du frontend
    const schoolId = session.user.schoolId;

    try {
      const [created] = await db.insert(schema.knowledgeResources).values({
        id,
        title: body.title ?? "",
        subtitle: body.subtitle,
        authors: body.authors,
        isbn: body.isbn,
        publisher: body.publisher,
        publicationYear: body.publicationYear,
        edition: body.edition,
        subject: body.subject,
        level: body.level,
        classLevel: body.classLevel,
        language: body.language,
        country: body.country || "Gabon",
        educationSystem: body.educationSystem,
        curriculum: body.curriculum,
        description: body.description,
        coverUrl: body.coverUrl,
        resourceType: body.resourceType,
        sourceType: "LOCAL_LIBRARY",
        sourceName: body.sourceName || "Bibliothèque établissement",
        sourceUrl: body.sourceUrl,
        externalId: body.externalId,
        accessMode: body.accessMode,
        rightsStatus: body.rightsStatus || "INSTITUTION_LICENSE",
        license: body.license,
        fileUrl: body.fileUrl,
        scope: body.scope || (schoolId ? "ESTABLISHMENT" : "GLOBAL"),
        schoolId: schoolId ?? undefined,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
        lastVerifiedAt: now,
        status: "active",
      }).returning();

      return NextResponse.json({ ok: true, item: toKnowledgeItem(rowToResource(created), "local") }, { status: 201 });
    } catch (dbError) {
      console.warn("Table non disponible, simulation:", dbError);
      const resource: KnowledgeResource = {
        id,
        title: body.title ?? "",
        subtitle: body.subtitle,
        authors: body.authors,
        isbn: body.isbn,
        publisher: body.publisher,
        publicationYear: body.publicationYear,
        edition: body.edition,
        subject: body.subject,
        level: body.level,
        classLevel: body.classLevel,
        language: body.language,
        country: body.country || "Gabon",
        educationSystem: body.educationSystem,
        curriculum: body.curriculum,
        description: body.description,
        coverUrl: body.coverUrl,
        resourceType: body.resourceType,
        sourceType: "LOCAL_LIBRARY",
        sourceName: body.sourceName || "Bibliothèque établissement",
        sourceUrl: body.sourceUrl,
        externalId: body.externalId,
        accessMode: body.accessMode,
        rightsStatus: body.rightsStatus || "INSTITUTION_LICENSE",
        license: body.license,
        fileUrl: body.fileUrl,
        scope: body.scope || (schoolId ? "ESTABLISHMENT" : "GLOBAL"),
        schoolId: schoolId ?? undefined,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
        status: "active",
      };
      return NextResponse.json({ ok: true, item: toKnowledgeItem(resource, "local") }, { status: 201 });
    }
  } catch (error) {
    console.error("Erreur POST /api/knowledge:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
// PUT - Modifier une ressource
export async function PUT(request: NextRequest) {
  try {
    const guard = await aiGuard(request, PERMISSIONS.KNOWLEDGE_MANAGE, "knowledge", "manage");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const session = {
      role: guard.ctx.role,
      user: { id: guard.ctx.userId, role: guard.ctx.role, schoolId: guard.ctx.schoolId ?? undefined },
      schoolId: guard.ctx.schoolId,
    };

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const body = normBody((await request.json()) as Record<string, unknown>);
    const now = new Date().toISOString();

    try {
      const [existing] = await db
        .select()
        .from(schema.knowledgeResources)
        .where(eq(schema.knowledgeResources.id, id))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "Ressource non trouvée" }, { status: 404 });
      }

      if (existing.schoolId && existing.schoolId !== session.user.schoolId && session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Non autorisé à modifier cette ressource" }, { status: 403 });
      }

      const [updated] = await db
        .update(schema.knowledgeResources)
        .set({
          title: body.title ?? "",
          subtitle: body.subtitle,
          authors: body.authors,
          isbn: body.isbn,
          publisher: body.publisher,
          publicationYear: body.publicationYear,
          edition: body.edition,
          subject: body.subject,
          level: body.level,
          classLevel: body.classLevel,
          language: body.language,
          country: body.country,
          educationSystem: body.educationSystem,
          curriculum: body.curriculum,
          description: body.description,
          coverUrl: body.coverUrl,
          resourceType: body.resourceType,
          sourceName: body.sourceName,
          sourceUrl: body.sourceUrl,
          accessMode: body.accessMode,
          rightsStatus: body.rightsStatus,
          license: body.license,
          fileUrl: body.fileUrl,
          scope: body.scope,
          updatedAt: now,
        })
        .where(eq(schema.knowledgeResources.id, id))
        .returning();

      return NextResponse.json({ ok: true, item: toKnowledgeItem(rowToResource(updated), "local") });
    } catch (dbError) {
      console.warn("Table non disponible:", dbError);
      return NextResponse.json({ error: "Base non disponible" }, { status: 503 });
    }
  } catch (error) {
    console.error("Erreur PUT /api/knowledge:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE - Archiver une ressource
export async function DELETE(request: NextRequest) {
  try {
    const guard = await aiGuard(request, PERMISSIONS.KNOWLEDGE_MANAGE, "knowledge", "manage");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const session = {
      role: guard.ctx.role,
      user: { id: guard.ctx.userId, role: guard.ctx.role, schoolId: guard.ctx.schoolId ?? undefined },
      schoolId: guard.ctx.schoolId,
    };

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const now = new Date().toISOString();

    try {
      const [existing] = await db
        .select()
        .from(schema.knowledgeResources)
        .where(eq(schema.knowledgeResources.id, id))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "Ressource non trouvée" }, { status: 404 });
      }

      if (existing.schoolId && existing.schoolId !== session.user.schoolId && session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Non autorisé à archiver cette ressource" }, { status: 403 });
      }

      await db
        .update(schema.knowledgeResources)
        .set({ status: "archived", updatedAt: now })
        .where(eq(schema.knowledgeResources.id, id));

      return NextResponse.json({ success: true, message: "Ressource archivée" });
    } catch (dbError) {
      console.warn("Table non disponible:", dbError);
      return NextResponse.json({ error: "Base non disponible" }, { status: 503 });
    }
  } catch (error) {
    console.error("Erreur DELETE /api/knowledge:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
// Fonctions utilitaires
function parseSearchParams(searchParams: URLSearchParams): KnowledgeSearchParams {
  return {
    query: searchParams.get("query") || undefined,
    subject: searchParams.get("subject") || undefined,
    level: searchParams.get("level") || undefined,
    classLevel: searchParams.get("classLevel") || undefined,
    language: searchParams.get("language") || undefined,
    country: searchParams.get("country") || undefined,
    sourceType: (searchParams.get("sourceType") as SourceType) || undefined,
    sourceName: searchParams.get("sourceName") || undefined,
    rightsStatus: (searchParams.get("rightsStatus") as RightsStatus) || undefined,
    accessMode: (searchParams.get("accessMode") as AccessMode) || undefined,
    scope: (searchParams.get("scope") as ResourceScope) || undefined,
    schoolId: searchParams.get("schoolId") || undefined,
    region: (searchParams.get("region") as "gabon" | "africa" | "international") || undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
  };
}

function buildWhereClause(params: KnowledgeSearchParams, session: { user: { schoolId?: string; role: string } }) {
  const conditions = [];
  conditions.push(eq(schema.knowledgeResources.status, "active"));

  if (session.user.schoolId) {
    conditions.push(
      or(
        eq(schema.knowledgeResources.scope, "GLOBAL"),
        and(
          eq(schema.knowledgeResources.scope, "ESTABLISHMENT"),
          eq(schema.knowledgeResources.schoolId, session.user.schoolId)
        ),
        and(
          eq(schema.knowledgeResources.scope, "PRIVATE"),
          eq(schema.knowledgeResources.schoolId, session.user.schoolId)
        )
      )
    );
  }

  if (params.query) {
    const q = `%${params.query}%`;
    conditions.push(
      or(
        ilike(schema.knowledgeResources.title, q),
        ilike(schema.knowledgeResources.authors, q),
        ilike(schema.knowledgeResources.isbn, q),
        ilike(schema.knowledgeResources.subject, q),
        ilike(schema.knowledgeResources.publisher, q)
      )
    );
  }

  if (params.subject) conditions.push(eq(schema.knowledgeResources.subject, params.subject));
  if (params.level) conditions.push(eq(schema.knowledgeResources.level, params.level));
  if (params.classLevel) conditions.push(eq(schema.knowledgeResources.classLevel, params.classLevel));
  if (params.language) conditions.push(eq(schema.knowledgeResources.language, params.language));
  if (params.country) conditions.push(eq(schema.knowledgeResources.country, params.country));
  if (params.sourceType) conditions.push(eq(schema.knowledgeResources.sourceType, params.sourceType));
  if (params.rightsStatus) conditions.push(eq(schema.knowledgeResources.rightsStatus, params.rightsStatus));
  if (params.accessMode) conditions.push(eq(schema.knowledgeResources.accessMode, params.accessMode));

  return and(...conditions);
}

function rowToResource(row: any): KnowledgeResource {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || undefined,
    authors: row.authors || undefined,
    isbn: row.isbn || undefined,
    publisher: row.publisher || undefined,
    publicationYear: row.publicationYear || undefined,
    edition: row.edition || undefined,
    subject: row.subject || undefined,
    level: row.level || undefined,
    classLevel: row.classLevel || undefined,
    language: row.language || undefined,
    country: row.country || undefined,
    educationSystem: row.educationSystem || undefined,
    curriculum: row.curriculum || undefined,
    description: row.description || undefined,
    coverUrl: row.coverUrl || undefined,
    resourceType: row.resourceType,
    sourceType: row.sourceType,
    sourceName: row.sourceName || undefined,
    sourceUrl: row.sourceUrl || undefined,
    externalId: row.externalId || undefined,
    accessMode: row.accessMode,
    rightsStatus: row.rightsStatus,
    license: row.license || undefined,
    fileUrl: row.fileUrl || undefined,
    scope: row.scope,
    schoolId: row.schoolId || undefined,
    createdBy: row.createdBy || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastVerifiedAt: row.lastVerifiedAt || undefined,
    status: row.status,
  };
}
