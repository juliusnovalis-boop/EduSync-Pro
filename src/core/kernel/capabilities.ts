/**
 * Catalogue de capacités métier.
 * Une capacité (ex. "ocr.extract", "qr.generate") est résolue vers le module
 * qui la réalise. Les appelants dépendent de la CAPACITÉ, pas du module.
 */
export class CapabilityCatalog {
  /** capabilityId → moduleId */
  private mapping = new Map<string, string>();
  private descriptions = new Map<string, string>();

  register(capabilityId: string, moduleId: string, description?: string): this {
    this.mapping.set(capabilityId, moduleId);
    if (description) this.descriptions.set(capabilityId, description);
    return this;
  }

  resolve(capabilityId: string): string | undefined {
    return this.mapping.get(capabilityId);
  }

  has(capabilityId: string): boolean {
    return this.mapping.has(capabilityId);
  }

  description(capabilityId: string): string | undefined {
    return this.descriptions.get(capabilityId);
  }

  list(): Array<{ capability: string; module: string; description?: string }> {
    return [...this.mapping.entries()].map(([capability, module]) => ({
      capability,
      module,
      description: this.descriptions.get(capability),
    }));
  }
}

/** Capacités normalisées d'EduSync Pro. */
export const CAPABILITIES = {
  TEXT_ANALYZE: "text.analyze",
  OCR_EXTRACT: "ocr.extract",
  AUDIO_TRANSCRIBE: "audio.transcribe",
  QR_GENERATE: "qr.generate",
  QR_VERIFY: "qr.verify",
  DOCUMENT_CREATE: "document.create",
  DATA_CRUD: "data.crud",
} as const;
