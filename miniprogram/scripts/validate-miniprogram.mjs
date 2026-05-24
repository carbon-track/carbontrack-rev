import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function requireFile(relativePath) {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fullPath;
}

function readJson(relativePath) {
  const fullPath = requireFile(relativePath);
  try {
    return JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${relativePath}: ${error.message}`);
  }
}

const project = readJson('project.config.json');
const appConfigPath = requireFile('src/app.config.js');
const appConfigSource = readFileSync(appConfigPath, 'utf8');
readJson('sitemap.json');

if (project.compileType !== 'miniprogram') {
  throw new Error('project.config.json must set compileType to "miniprogram".');
}

if (project.miniprogramRoot !== 'dist/') {
  throw new Error('project.config.json must set miniprogramRoot to "dist/".');
}

const pagesBlock = appConfigSource.match(/pages\s*:\s*\[([\s\S]*?)\]/);
if (!pagesBlock) {
  throw new Error('src/app.config.js must declare pages.');
}

const pages = Array.from(pagesBlock[1].matchAll(/['"]([^'"]+)['"]/g), (match) => match[1]);
if (pages.length === 0) {
  throw new Error('src/app.config.js must declare at least one page.');
}

for (const page of pages) {
  requireFile(`src/${page}.jsx`);
  requireFile(`src/${page}.css`);
}

const requiredEnvNames = ['TARO_APP_API_URL', 'TARO_APP_MOBILE_CLIENT_TOKEN'];
for (const envName of requiredEnvNames) {
  if (!readFileSync(requireFile('.env.example'), 'utf8').includes(envName)) {
    throw new Error(`.env.example must document ${envName}.`);
  }
}

console.log(`Validated Taro miniprogram config with ${pages.length} pages.`);
