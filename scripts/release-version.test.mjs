import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = fileURLToPath(new URL('./release-version.mjs', import.meta.url));

test('release version is consistent across packages, locks and binaries', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'tko-release-'));
  try {
    for (const dir of ['', 'tko-cli/']) {
      mkdirSync(join(cwd, dir, 'src'), { recursive: true });
      writeFileSync(join(cwd, dir, 'package.json'), JSON.stringify({ name: dir || 'tko', version: '0.1.0' }));
      writeFileSync(join(cwd, dir, 'package-lock.json'), JSON.stringify({ version: '0.1.0', packages: { '': { version: '0.1.0' }, 'node_modules/example': { version: '9.8.7' } } }));
    }
    const result = spawnSync(process.execPath, [script, 'v2.3.0'], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const dir of ['', 'tko-cli/']) {
      assert.equal(JSON.parse(readFileSync(join(cwd, dir, 'package.json'))).version, '2.3.0');
      const lock = JSON.parse(readFileSync(join(cwd, dir, 'package-lock.json')));
      assert.equal(lock.version, '2.3.0');
      assert.equal(lock.packages[''].version, '2.3.0');
      assert.equal(lock.packages['node_modules/example'].version, '9.8.7');
      assert.equal(readFileSync(join(cwd, dir, 'src/version.ts'), 'utf8'), "export const version = '2.3.0';\n");
    }
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('invalid release tags fail before writing any files', () => {
  for (const tag of ['main', 'v1.2', 'v01.2.3', 'v1.2.3-rc.1', 'v1.2.3\n', 'v1.2.3;echo bad']) {
    const cwd = mkdtempSync(join(tmpdir(), 'tko-release-invalid-'));
    try {
      const result = spawnSync(process.execPath, [script, tag], { cwd, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Release tags must use/);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});
