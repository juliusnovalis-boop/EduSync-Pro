import crypto from "node:crypto";

/**
 * F-17 (pentest #2) — Hachage de mots de passe.
 *
 * AVANT : `sha256(password)` — non salé, non itéré → rainbow tables (une table
 * SHA-256 couvre TOUS les comptes simultanément) et brute-force GPU trivial.
 *
 * APRÈS : scrypt (KDF à coût mémoire, recommandé OWASP) avec SEL ALÉATOIRE par
 * utilisateur et paramètres versionnés dans la chaîne stockée :
 *
 *     scrypt$N$r$p$<salt-base64url>$<derived-key-base64url>
 *
 * Le format est auto-descriptif : les paramètres sont relus depuis la valeur
 * stockée, ce qui permet de les durcir plus tard sans casser les comptes
 * existants (rehash transparent à la prochaine connexion réussie).
 *
 * COMPATIBILITÉ ASCENDANTE : `verifyPassword` sait encore vérifier un ancien
 * condensé SHA-256 hexadécimal de 64 caractères et signale `needsRehash: true`
 * — les appelants doivent alors réécrire le hash. Aucun compte n'est donc
 * invalidé par le déploiement, et aucune donnée n'est perdue.
 */

/** Paramètres du KDF (OWASP : scrypt N=2^14, r=8, p=1 minimum). */
export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

/** Longueur du sel en octets (128 bits — jamais réutilisé). */
export const SALT_BYTES = 16;

/** Identifiant de schéma présent en tête de chaque condensé produit ici. */
export const HASH_SCHEME = "scrypt";

/** Bornes de longueur de mot de passe (politique minimale côté serveur). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Un condensé SHA-256 legacy = 64 caractères hexadécimaux. */
const LEGACY_SHA256_RE = /^[0-9a-f]{64}$/;

const BASE64URL = "base64url" as const;

/**
 * Dérive une clé scrypt (promisifié — la version synchrone bloquerait
 * l'event-loop du runtime serverless).
 * `maxmem` est relevé car la limite Node par défaut (32 MiB) est atteinte
 * dès N=16384, r=8 (128 · N · r = 16 MiB de pic, + marge de sécurité).
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keylen,
      { N: params.N, r: params.r, p: params.p, maxmem: 128 * params.N * params.r * 2 },
      (err, derived) => (err ? reject(err) : resolve(derived as Buffer)),
    );
  });
}

/** Condensé SHA-256 non salé — UNIQUEMENT pour vérifier d'anciens comptes. */
export function legacySha256(input: string): string {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

/** Vrai si la valeur stockée est un ancien condensé SHA-256 (à migrer). */
export function isLegacySha256Hash(stored: string | null | undefined): boolean {
  return typeof stored === "string" && LEGACY_SHA256_RE.test(stored);
}

/**
 * Hache un mot de passe avec scrypt + sel aléatoire.
 * Renvoie `scrypt$N$r$p$salt$hash` (jamais le mot de passe).
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scryptAsync(String(plain), salt, SCRYPT_PARAMS.keylen, SCRYPT_PARAMS);
  return [
    HASH_SCHEME,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString(BASE64URL),
    derived.toString(BASE64URL),
  ].join("$");
}

/**
 * Vérifie un mot de passe face à un condensé stocké.
 *  • format `scrypt$…` → vérification scrypt (comparaison à temps constant) ;
 *  • ancien format SHA-256 hex → vérification legacy, `needsRehash: true`.
 *
 * Ne lève jamais : un condensé corrompu/absent renvoie `ok: false` sans fuite.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  const value = typeof stored === "string" ? stored : "";
  if (!value) return { ok: false, needsRehash: false };

  if (value.startsWith(`${HASH_SCHEME}$`)) {
    const parts = value.split("$");
    if (parts.length !== 6) return { ok: false, needsRehash: false };
    const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) {
      return { ok: false, needsRehash: false };
    }
    let salt: Buffer;
    let expected: Buffer;
    try {
      salt = Buffer.from(saltRaw, BASE64URL);
      expected = Buffer.from(hashRaw, BASE64URL);
    } catch {
      return { ok: false, needsRehash: false };
    }
    if (!salt.length || !expected.length) return { ok: false, needsRehash: false };
    let derived: Buffer;
    try {
      derived = await scryptAsync(String(plain), salt, expected.length, { N, r, p });
    } catch {
      return { ok: false, needsRehash: false };
    }
    const ok = derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    return { ok, needsRehash: false };
  }

  // Ancien condensé SHA-256 (non salé) — vérification puis migration.
  if (isLegacySha256Hash(value)) {
    const candidate = Buffer.from(legacySha256(plain));
    const expected = Buffer.from(value);
    const ok =
      candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}

/** Vrai si le mot de passe respecte la politique minimale serveur. */
export function satisfiesPasswordPolicy(plain: string): boolean {
  const value = String(plain ?? "");
  return value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH;
}

/**
 * F-16 (pentest #2) — Mots de passe qui ont été ÉCRITS DANS LE CODE SOURCE
 * (donc dans l'historique Git public) et sont, par définition, COMPROMIS.
 *
 * Les durcir (scrypt) ne les rend pas sûrs : le secret lui-même est public.
 * Ils doivent être ROTÉS. On les détecte pour émettre une alerte d'audit à
 * chaque connexion réussie les utilisant encore — la rotation reste une action
 * opérateur (console fournisseur / interface applicative), jamais automatique.
 */
export const COMPROMISED_DEFAULT_PASSWORDS: readonly string[] = [
  "admin26",
  "demo2026",
  "teach2026",
  "stu2026",
];

/** Vrai si le mot de passe fait partie des secrets historiquement fuités. */
export function isKnownDefaultPassword(plain: string): boolean {
  return COMPROMISED_DEFAULT_PASSWORDS.includes(String(plain ?? ""));
}
