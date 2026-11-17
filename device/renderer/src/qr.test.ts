import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { buildQrUrl, getQrPixelSize } from "./qr";

describe("QR Code", () => {
  it("builds correct URL appending ?d=<deviceId>&src=tv for our domain", () => {
    expect(buildQrUrl("https://adsense.davidpetrea.ro/offer", "display-1234")).toBe(
      "https://adsense.davidpetrea.ro/offer?d=display-1234&src=tv",
    );
  });

  it("never outputs localhost or undefined", () => {
    expect(buildQrUrl("http://localhost:8765/offer", "display-1234")).toBe(
      "https://adsense.davidpetrea.ro/offer?d=display-1234&src=tv",
    );
    expect(buildQrUrl("undefined", undefined)).toBe(
      "https://adsense.davidpetrea.ro/offer?src=tv",
    );
    expect(buildQrUrl("", "undefined")).toBe(
      "https://adsense.davidpetrea.ro/offer?src=tv",
    );
  });

  it("calculates QR size relative to short side (32%, 40%, 48%)", () => {
    const width = 1920;
    const height = 1080;
    expect(getQrPixelSize("S", width, height)).toBe(Math.round(1080 * 0.32));
    expect(getQrPixelSize("M", width, height)).toBe(Math.round(1080 * 0.40));
    expect(getQrPixelSize("L", width, height)).toBe(Math.round(1080 * 0.48));
  });

  it("generates a QR code and decodes it back correctly using jsQR", () => {
    const targetUrl = "https://adsense.davidpetrea.ro/offer?d=disp-abc&src=tv";
    const qr = QRCode.create(targetUrl, { errorCorrectionLevel: "M", margin: 4 });
    const moduleCount = qr.modules.size;
    const scale = 8;
    const imgSize = moduleCount * scale;
    const rgba = new Uint8ClampedArray(imgSize * imgSize * 4);

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        const isDark = qr.modules.get(r, c);
        const color = isDark ? 0 : 255;
        for (let py = 0; py < scale; py++) {
          for (let px = 0; px < scale; px++) {
            const index = ((r * scale + py) * imgSize + (c * scale + px)) * 4;
            rgba[index] = color;
            rgba[index + 1] = color;
            rgba[index + 2] = color;
            rgba[index + 3] = 255;
          }
        }
      }
    }

    const decoded = jsQR(rgba, imgSize, imgSize);
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(targetUrl);
  });
});
