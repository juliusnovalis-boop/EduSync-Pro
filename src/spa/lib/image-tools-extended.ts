// Outils image étendus côté navigateur (canvas) — aucun envoi serveur requis.
// Tous les outils sont vraiment implémentés avec l''API Canvas du navigateur.

const MAX_CANVAS_SIZE = 8192;

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

/**
 * Rogner une image selon un pourcentage de la zone centrale.
 * Le texte optionnel permet de spécifier un ratio (ex: "1:1", "4:3", "16:9").
 */
export async function cropImage(file: File, options?: { ratio?: string; focus?: "center" | "top" | "bottom" | "left" | "right" }): Promise<{ url: string; name: string }> {
  const bitmap = await loadBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;
  let sx = 0;
  let sy = 0;

  const ratio = options?.ratio;
  if (ratio) {
    const parts = ratio.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      const targetRatio = parts[0] / parts[1];
      if (w / h > targetRatio) {
        const newW = h * targetRatio;
        sx = (w - newW) / 2;
        w = newW;
      } else {
        const newH = w / targetRatio;
        sy = (h - newH) / 2;
        h = newH;
      }
    }
  }

  sx = Math.round(sx);
  sy = Math.round(sy);
  w = Math.round(w);
  h = Math.round(h);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, sx, sy, w, h, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Rogage impossible.");
  return { url: URL.createObjectURL(blob), name: baseName(file.name) + "-cropped.png" };
}

/** Faire pivoter une image d''un angle (90, 180, 270, ou custom). */
export async function rotateImage(file: File, angle: number = 90): Promise<{ url: string; name: string }> {
  const bitmap = await loadBitmap(file);
  const rad = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const canvasW = Math.round(bitmap.width * cos + bitmap.height * sin);
  const canvasH = Math.round(bitmap.width * sin + bitmap.height * cos);

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(canvasW, MAX_CANVAS_SIZE);
  canvas.height = Math.min(canvasH, MAX_CANVAS_SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate(rad);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Rotation impossible.");
  return { url: URL.createObjectURL(blob), name: `${baseName(file.name)}-rotated.png` };
}

/** Retourner une image horizontalement ou verticalement. */
export async function flipImage(file: File, direction: "horizontal" | "vertical"): Promise<{ url: string; name: string }> {
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.scale(direction === "horizontal" ? -1 : 1, direction === "vertical" ? -1 : 1);
  if (direction === "horizontal") ctx.drawImage(bitmap, -bitmap.width, 0);
  else ctx.drawImage(bitmap, 0, -bitmap.height);
  ctx.restore();

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Retournement impossible.");
  return { url: URL.createObjectURL(blob), name: `${baseName(file.name)}-flipped-${direction}.png` };
}

/** Convertir une image en niveaux de gris. */
export async function grayscaleImage(file: File): Promise<{ url: string; name: string }> {
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "grayscale(100%)";
  ctx.drawImage(bitmap, 0, 0);
  ctx.filter = "none";

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Conversion en niveaux de gris impossible.");
  return { url: URL.createObjectURL(blob), name: baseName(file.name) + "-grayscale.jpg" };
}

/** Ajouter une bordure colorée autour d''une image. La largeur est passée en texte. */
export async function addBorderImage(file: File, borderWidthInput?: string, color?: string): Promise<{ url: string; name: string }> {
  const bitmap = await loadBitmap(file);
  const borderWidth = Math.min(parseInt(borderWidthInput ?? "20", 10) || 20, 200);
  const borderColor = color || "#000000";

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width + borderWidth * 2;
  canvas.height = bitmap.height + borderWidth * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, borderWidth, borderWidth);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Ajout de bordure impossible.");
  return { url: URL.createObjectURL(blob), name: baseName(file.name) + "-border.png" };
}

/** Ajouter un filigrane texte sur une image. */
export async function addWatermarkImage(file: File, text?: string): Promise<{ url: string; name: string }> {
  const bitmap = await loadBitmap(file);
  const watermarkText = text || "EduSync";

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);

  const fontSize = Math.max(16, Math.min(bitmap.width, bitmap.height) / 12);
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(bitmap.width / 2, bitmap.height / 2);
  ctx.rotate((-20 * Math.PI) / 180);
  ctx.fillText(watermarkText, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Ajout de filigrane impossible.");
  return { url: URL.createObjectURL(blob), name: baseName(file.name) + "-watermark.png" };
}