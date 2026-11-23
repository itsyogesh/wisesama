import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Client generation also runs when installing the frontend workspace.
    url: process.env.DATABASE_URL ?? '',
  },
});
