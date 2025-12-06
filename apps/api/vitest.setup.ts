/**
 * Vitest Setup File
 * This runs before all tests to set up the test environment
 */

// Set environment variables before any modules are loaded
process.env.SUBSCAN_API_KEY = 'test-api-key';
process.env.VIRUSTOTAL_API_KEY = 'test-vt-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
