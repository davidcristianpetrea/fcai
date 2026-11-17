import QRCode from "qrcode";

export type QrSizeMode = "S" | "M" | "L" | number;

export interface QrOptions {
  configuredLink?: string;
  deviceId?: string;
  sizeMode?: QrSizeMode;
  screenWidth: number;
  screenHeight: number;
}

export function buildQrUrl(configuredLink: string | undefined, deviceId: string | undefined): string {
  let link = (configuredLink || "").trim();
  if (
    !link ||
    link === "undefined" ||
    link.includes("localhost") ||
    link.includes("127.0.0.1") ||
    link.startsWith("file:")
  ) {
    link = "https://adsense.davidpetrea.ro/offer";
  }

  try {
    const url = new URL(link);
    const isOurDomain =
      url.hostname === "adsense.davidpetrea.ro" ||
      url.hostname.endsWith(".davidpetrea.ro") ||
      url.pathname.startsWith("/offer");

    if (isOurDomain) {
      if (deviceId && deviceId !== "undefined" && deviceId !== "display") {
        url.searchParams.set("d", deviceId);
      }
      url.searchParams.set("src", "tv");
      return url.toString();
    }
    return url.toString();
  } catch {
    const safeDeviceId = deviceId && deviceId !== "undefined" && deviceId !== "display" ? deviceId : "";
    return safeDeviceId
      ? `https://adsense.davidpetrea.ro/offer?d=${encodeURIComponent(safeDeviceId)}&src=tv`
      : `https://adsense.davidpetrea.ro/offer?src=tv`;
  }
}

export function getQrPixelSize(sizeMode: QrSizeMode | undefined, screenWidth: number, screenHeight: number): number {
  const shortSide = Math.min(screenWidth, screenHeight);
  if (typeof sizeMode === "number" && !isNaN(sizeMode) && sizeMode > 50) {
    // If a raw pixel size was passed, clamp to reasonable screen ratio (0.25 to 0.60)
    return Math.max(Math.round(shortSide * 0.25), Math.min(Math.round(shortSide * 0.6), sizeMode));
  }
  // S = 32%, M = 40%, L = 48% of the screen's short side
  switch (sizeMode) {
    case "S":
    case "160":
      return Math.round(shortSide * 0.32);
    case "L":
    case "300":
      return Math.round(shortSide * 0.48);
    case "M":
    case "220":
    default:
      return Math.round(shortSide * 0.40);
  }
}

export async function generateQrDataUrl(
  text: string,
  pixelSize: number,
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 4,
    color: {
      dark: "#0a0d14",
      light: "#ffffff",
    },
    width: pixelSize,
  });
}
