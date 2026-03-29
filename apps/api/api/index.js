// Vercel serverless handler
// Dynamic import for ESM bundle compatibility
export default async function handler(req, res) {
  const app = await import('../dist/index.mjs');
  const fn = app.default;
  return fn(req, res);
}
