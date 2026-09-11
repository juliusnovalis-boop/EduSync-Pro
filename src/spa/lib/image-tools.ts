// Outils image côté navigateur (canvas) — aucun envoi serveur requis.

/** Compresse une image via canvas avec la qualité donnée (0-1). */
export async function compressImage(file: File, quality = 0.6): Promise<{ url: string; name: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new Error("Compression impossible.");
  return { url: URL.createObjectURL(blob), name: baseName(file.name) + "-compressed.jpg" };
}

/** Convertit une image vers un autre format (image/png, image/jpeg, image/webp). */
export async function convertImage(file: File, type: string): Promise<{ url: string; name: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type));
  if (!blob) throw new Error("Conversion impossible.");
  const ext = type.split("/")[1] ?? "png";
  return { url: URL.createObjectURL(blob), name: baseName(file.name) + "." + ext };
}

/** Redimensionne une image pour que son plus grand côté ne dépasse pas maxDim. */
export async function resizeImage(file: File, maxDim = 1280): Promise<{ url: string; name: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Redimensionnement impossible.");
  return { url: URL.createObjectURL(blob), name: baseName(file.name) + "-resized.jpg" };
}

function baseName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
