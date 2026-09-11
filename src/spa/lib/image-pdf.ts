// Image → PDF via jsPDF (traitement 100% navigateur).

import { jsPDF } from "jspdf";

export async function pdfFromImage(file: File): Promise<{ url: string; name: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });

  const bitmap = await createImageBitmap(file);
  const orientation = bitmap.width > bitmap.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / bitmap.width, pageH / bitmap.height);
  const w = bitmap.width * ratio;
  const h = bitmap.height * ratio;

  const isPng = file.type === "image/png";
  pdf.addImage(dataUrl, isPng ? "PNG" : "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return { url: URL.createObjectURL(pdf.output("blob")), name: `${base}.pdf` };
}
