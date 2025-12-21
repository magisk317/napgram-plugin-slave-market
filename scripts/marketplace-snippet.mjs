import fs from 'node:fs/promises';
import path from 'node:path';

function sanitizeId(input) {
  return String(input || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 64) || 'plugin';
}

const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
const meta = JSON.parse(await fs.readFile(new URL('../napgram-plugin.json', import.meta.url), 'utf8'));
const id = sanitizeId(meta.id || pkg.name);
const version = pkg.version;

const releaseDir = path.resolve('release');
const entries = await fs.readdir(releaseDir).catch(() => []);

function pick(ext) {
  return entries.find(f => f === `${id}-${version}.${ext}`);
}

const zip = pick('zip');
const tgz = pick('tgz');

async function readSha(file) {
  const shaFile = path.join(releaseDir, `${file}.sha256`);
  const raw = await fs.readFile(shaFile, 'utf8');
  return raw.split(/\s+/)[0].trim();
}

const out = {
  schemaVersion: 1,
  kind: "native",
  plugins: [
    {
      id,
      name: meta.name || 'NapGram Plugin',
      versions: [
        {
          version,
          entry: { type: 'file', path: String(meta.entry || 'dist/index.mjs') },
          dist: zip ? { type: 'zip', url: `https://YOUR_HOST/${zip}`, sha256: await readSha(zip) }
            : tgz ? { type: 'tgz', url: `https://YOUR_HOST/${tgz}`, sha256: await readSha(tgz) }
              : { type: 'zip', url: 'https://YOUR_HOST/FILE.zip', sha256: '...sha256...' },
          permissions: meta.permissions || { network: [], fs: [], instances: [0] }
        }
      ]
    }
  ]
};

console.log(JSON.stringify(out, null, 2));
