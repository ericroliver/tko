import { cosmiconfig } from 'cosmiconfig';
import { ConfigSchema, Config, DEFAULT_CONFIG } from './schema.js';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const explorer = cosmiconfig('tko');
const legacyExplorer = cosmiconfig('tinytask');

async function searchConfig() {
  return (await explorer.search()) ?? (await legacyExplorer.search());
}

export async function loadConfig(options: {
  profile?: string;
  url?: string;
  outputFormat?: string;
}): Promise<Config> {
  const env = getEnvironment();
  // Start with defaults
  let config: Config = { ...DEFAULT_CONFIG };

  // Load from config file - try home directory first
  const homeConfigPath = getConfigPath();
  try {
    const homeConfigContent = await fs.readFile(homeConfigPath, 'utf-8');
    try {
      const homeConfig = JSON.parse(homeConfigContent);
      config = { ...config, ...homeConfig };
    } catch (parseError) {
      // Invalid JSON in home config, try searching from current directory
      const result = await searchConfig();
      if (result?.config) {
        config = { ...config, ...result.config };
      }
    }
  } catch (error) {
    // Home config doesn't exist, try searching from current directory
    try {
      const result = await searchConfig();
      if (result?.config) {
        config = { ...config, ...result.config };
      }
    } catch (error) {
      // Config file is optional, continue with defaults
    }
  }

  // Apply profile if specified
  if (options.profile) {
    if (!config.profiles?.[options.profile]) {
      throw new Error(`Profile '${options.profile}' not found in configuration`);
    }
    config = { ...config, ...config.profiles[options.profile] };
    config.activeProfile = options.profile;
  } else if (config.activeProfile && config.profiles?.[config.activeProfile]) {
    // Use active profile from config file
    config = { ...config, ...config.profiles[config.activeProfile] };
  }

  // Environment variable overrides
  if (env.URL) {
    config.url = env.URL;
  }
  const agent = process.env.TKO_AGENT ?? process.env.TINYTASK_AGENT;
  if (agent) config.agent = agent;
  if (env.FORMAT) {
    config.outputFormat = env.FORMAT as 'table' | 'json' | 'csv' | 'compact';
  }
  if (env.NO_COLOR === 'true') {
    config.colorOutput = false;
  }
  if (env.TIMEOUT) {
    config.timeout = parseInt(env.TIMEOUT);
  }

  // CLI option overrides (highest priority)
  if (options.url) {
    config.url = options.url;
  }
  if (options.outputFormat) {
    config.outputFormat = options.outputFormat as 'table' | 'json' | 'csv' | 'compact';
  }

  // Validate final configuration
  return ConfigSchema.parse(config);
}

export function getConfigPath(): string {
  const env = getEnvironment();
  // Allow override via environment variable
  if (env.CONFIG_PATH) {
    return env.CONFIG_PATH;
  }
  const current = path.join(os.homedir(), '.tkorc.json');
  const legacy = path.join(os.homedir(), '.tinytaskrc.json');
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}

export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function initConfig(): Promise<Config> {
  const defaultConfig: Config = {
    ...DEFAULT_CONFIG,
    url: 'http://localhost:3000/mcp',
  };

  await saveConfig(defaultConfig);
  return defaultConfig;
}

function getEnvironment() {
  return {
    URL: process.env.TKO_URL ?? process.env.TINYTASK_URL,
    FORMAT: process.env.TKO_FORMAT ?? process.env.TINYTASK_FORMAT,
    NO_COLOR: process.env.TKO_NO_COLOR ?? process.env.TINYTASK_NO_COLOR,
    TIMEOUT: process.env.TKO_TIMEOUT ?? process.env.TINYTASK_TIMEOUT,
    CONFIG_PATH: process.env.TKO_CONFIG_PATH ?? process.env.TINYTASK_CONFIG_PATH,
  };
}
