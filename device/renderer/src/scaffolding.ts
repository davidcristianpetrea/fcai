export type RendererMode = "splash" | "identify" | "simulator" | "live";

export interface DebugHud {
  set(values: Record<string, string | number | boolean>): void;
  hide(): void;
}

export function createDebugHud(element: HTMLElement): DebugHud {
  return {
    set(values) {
      element.textContent = Object.entries(values)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join("\n");
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
    },
  };
}

export function renderSplash(root: HTMLElement, message = "AdSense"): void {
  root.replaceChildren();
  const heading = document.createElement("h1");
  heading.textContent = message;
  root.append(heading);
}

export function renderIdentify(root: HTMLElement, deviceId: string): void {
  root.replaceChildren();
  const label = document.createElement("p");
  label.textContent = `Device: ${deviceId}`;
  root.append(label);
}

export function renderSimulator(root: HTMLElement): void {
  root.dataset.mode = "simulator";
}
