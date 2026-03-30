import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: false,
  clean: true,
  noExternal: ['@wisesama/database'],
  // Prisma client uses CJS require() internally — must stay external
  external: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
});
