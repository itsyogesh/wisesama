// Vercel serverless handler - imports from pre-built bundle
// This avoids ESM module resolution issues by using the bundled CJS output
const handler = require('../dist/index.js');
module.exports = handler.default || handler;
