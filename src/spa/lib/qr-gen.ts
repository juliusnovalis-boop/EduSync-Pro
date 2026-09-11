// Génération de QR code via la librairie qrcode (navigateur).

import QRCode from "qrcode";

export async function generateQr(text: string): Promise<{ url: string; name: string }> {
  const dataUrl = await QRCode.toDataURL(text, { width: 512, margin: 2 });
  const blob = await (await fetch(dataUrl)).blob();
  return { url: URL.createObjectURL(blob), name: "qrcode.png" };
}
