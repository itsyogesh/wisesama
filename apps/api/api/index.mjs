// Vercel serverless handler — ESM dynamic import
export default async function handler(req, res) {
  const app = await import('../dist/index.mjs');
  const fn = app.default;
  return fn(req, res);
}
