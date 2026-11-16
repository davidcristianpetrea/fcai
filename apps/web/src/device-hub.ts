export class DeviceHub {
  constructor(private readonly state: DurableObjectState) {}

  fetch(request: Request): Response {
    if (new URL(request.url).pathname !== "/health") {
      return new Response("Not found", { status: 404 });
    }
    return Response.json({ ok: true });
  }
}
