export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MEDIA_BUCKET: R2Bucket;
  DEVICE_HUB: DurableObjectNamespace;
  SESSION_SECRET: string;
  ENVIRONMENT: string;
}
