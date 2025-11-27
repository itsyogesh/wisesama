// Vercel serverless handler - imports from pre-built CJS bundle
const handler = require('../dist/index.js');
module.exports = handler.default || handler;
