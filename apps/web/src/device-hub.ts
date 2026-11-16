import type { WebSocket } from "ws";
import type Database from "better-sqlite3";

type DeviceMessage = {
  type?: string;
  deviceId?: string;
  lastStatus?: string;
  config?: unknown;
};

export class DeviceHub {
  private readonly sockets = new Map<string, WebSocket>();
  private readonly lastWrite = new Map<string, { at: number; status: string | undefined }>();

  constructor(private readonly db: Database.Database) {}

  connect(deviceId: string, socket: WebSocket): void {
    this.sockets.get(deviceId)?.close(1000, "replaced");
    this.sockets.set(deviceId, socket);
    this.touch(deviceId);
    socket.on("close", () => {
      if (this.sockets.get(deviceId) === socket) this.sockets.delete(deviceId);
    });
  }

  sendConfig(deviceId: string, config: unknown): boolean {
    const socket = this.sockets.get(deviceId);
    if (!socket || socket.readyState !== socket.OPEN) return false;
    socket.send(JSON.stringify({ type: "config", config }));
    return true;
  }

  handle(deviceId: string, message: DeviceMessage): void {
    if (message.type === "heartbeat" || message.type === "status") {
      this.touch(deviceId, message.lastStatus);
    }
  }

  isOnline(deviceId: string): boolean {
    const row = this.db.prepare("SELECT last_seen_at FROM devices WHERE id = ?").get(deviceId) as { last_seen_at?: string } | undefined;
    return Boolean(row?.last_seen_at && Date.now() - Date.parse(row.last_seen_at) <= 90_000);
  }

  private touch(deviceId: string, status?: string): void {
    const now = Date.now();
    const previous = this.lastWrite.get(deviceId);
    if (previous && now - previous.at < 60_000 && previous.status === status) return;
    const timestamp = new Date(now).toISOString();
    this.db.prepare("UPDATE devices SET last_seen_at = ?, last_status = ? WHERE id = ?").run(timestamp, status ?? null, deviceId);
    this.lastWrite.set(deviceId, { at: now, status });
  }
}
