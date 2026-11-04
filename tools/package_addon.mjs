import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const releasesDir = path.join(root, 'releases');
fs.mkdirSync(releasesDir, { recursive: true });

const mcaddonPath = path.join(root, 'SwordsAndMoreSwords_Remake.mcaddon');
const bpPackPath = path.join(releasesDir, 'SwordsAndMoreSwords_BP.mcpack');
const rpPackPath = path.join(releasesDir, 'SwordsAndMoreSwords_RP.mcpack');

for (const p of [mcaddonPath, bpPackPath, rpPackPath]) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// 1. Build combined .mcaddon (with Swords_B/ and Swords_R/ at archive root)
execSync(`cd packs && zip -r -9 -q "${mcaddonPath}" Swords_B Swords_R`, { stdio: 'inherit' });

// 2. Build individual .mcpack archives (with manifest.json at archive root)
execSync(`cd packs/Swords_B && zip -r -9 -q "${bpPackPath}" .`, { stdio: 'inherit' });
execSync(`cd packs/Swords_R && zip -r -9 -q "${rpPackPath}" .`, { stdio: 'inherit' });

for (const p of [mcaddonPath, bpPackPath, rpPackPath]) {
  const sizeKb = (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`Built ${path.relative(root, p)} (${sizeKb} KB)`);
}
