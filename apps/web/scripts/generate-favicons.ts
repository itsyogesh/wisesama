import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const publicDir = resolve(__dirname, '../public');
const svgPath = resolve(publicDir, 'favicon.svg');

async function generateFavicons() {
  const svgBuffer = readFileSync(svgPath);

  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(resolve(publicDir, name));
    console.log(`Generated ${name}`);
  }

  // Generate ICO (48x48 PNG as base)
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(resolve(publicDir, 'favicon.ico'));
  console.log('Generated favicon.ico');

  console.log('All favicons generated successfully!');
}

generateFavicons().catch(console.error);
