import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getConfigPath, loadConfig, saveConfig } from '../../../src/config/loader.js';

describe('TKO configuration migration', () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(path.join(os.tmpdir(), 'tko-config-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(home, { recursive: true, force: true });
  });
  it('prefers TKO variables over legacy values, including false', async () => {
    vi.stubEnv('TKO_URL', 'http://new:3000/mcp');
    vi.stubEnv('TINYTASK_URL', 'http://old:3000/mcp');
    vi.stubEnv('TKO_NO_COLOR', 'false');
    vi.stubEnv('TINYTASK_NO_COLOR', 'true');
    const config = await loadConfig({});
    expect(config.url).toBe('http://new:3000/mcp');
    expect(config.colorOutput).toBe(true);
  });
  it('reads and updates the existing legacy home configuration', async () => {
    const legacy = path.join(home, '.tinytaskrc.json');
    writeFileSync(legacy, JSON.stringify({ url: 'http://legacy:3000/mcp' }));
    expect(getConfigPath()).toBe(legacy);
    const config = await loadConfig({});
    expect(config.url).toBe('http://legacy:3000/mcp');
    await saveConfig({ ...config, url: 'http://updated:3000/mcp' });
    expect((await loadConfig({})).url).toBe('http://updated:3000/mcp');
  });
  it('prefers the new home configuration when both exist', async () => {
    writeFileSync(path.join(home, '.tinytaskrc.json'), JSON.stringify({ url: 'http://old:3000/mcp' }));
    writeFileSync(path.join(home, '.tkorc.json'), JSON.stringify({ url: 'http://new:3000/mcp' }));
    expect((await loadConfig({})).url).toBe('http://new:3000/mcp');
  });
  it('prefers the new explicit configuration path', () => {
    vi.stubEnv('TINYTASK_CONFIG_PATH', '/old/config.json');
    vi.stubEnv('TKO_CONFIG_PATH', '/new/config.json');
    expect(getConfigPath()).toBe('/new/config.json');
  });
});
