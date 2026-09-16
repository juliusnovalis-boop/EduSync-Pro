/** Barrel de la couche sécurité — EduSync Pro. */
export * from "./cors";
export * from "./headers";
export * from "./http";
export * from "./password";

export {
  postgresRateLimitStore,
  ensureRateLimitSchema,
  loginRateLimiter,
  hit,
  lockDurationForAttempts,
  normalizeLoginKey,
  emailBucketKey,
  accountLockKey,
  ipBucketKey,
  endpointBucketKey,
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  SENSITIVE_ENDPOINT_LIMIT,
  SETTINGS_ENDPOINT_LIMIT,
  type LimitRule,
  type WindowResult,
  type RateLimitStore,
  type BucketRow,
  type LockRow,
} from "./rate-limit";