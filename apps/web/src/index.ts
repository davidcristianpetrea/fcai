import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (context) => context.json({ ok: true }));

export default app;
