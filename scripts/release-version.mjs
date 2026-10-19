// Usage: node scripts/release-version.mjs v2.3.0
// Stamps the build checkout only; does not commit or create tags.
import { readFileSync, writeFileSync } from 'node:fs';
const tag = process.argv[2];
if (typeof tag !== 'string' || tag.trim() !== tag || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? '')) {
  throw new Error('Release tags must use vMAJOR.MINOR.PATCH (for example v2.3.0)');
}
const version = tag.slice(1);
for (const dir of ['', 'tko-cli/']) {
  for (const name of ['package.json', 'package-lock.json']) {
    const file = dir + name;
    const json = JSON.parse(readFileSync(file, 'utf8'));
    json.version = version;
    if (json.packages?.['']) json.packages[''].version = version;
    writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  }
  writeFileSync(dir + 'src/version.ts', `export const version = '${version}';\n`);
}
