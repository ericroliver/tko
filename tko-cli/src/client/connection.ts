import { TKOClient } from './mcp-client.js';

let clientInstance: TKOClient | null = null;

export function getClient(url: string): TKOClient {
  if (!clientInstance) {
    clientInstance = new TKOClient(url);
  }
  return clientInstance;
}

export async function ensureConnected(url: string): Promise<TKOClient> {
  const client = getClient(url);
  await client.connect();
  return client;
}

export async function disconnect(): Promise<void> {
  if (clientInstance) {
    await clientInstance.disconnect();
    clientInstance = null;
  }
}
