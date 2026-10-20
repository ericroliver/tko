import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../src/client/mcp-client.js', () => ({
  TKOClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));
import { TKOClient } from '../../../src/client/mcp-client.js';
import { getClient, ensureConnected, disconnect } from '../../../src/client/connection.js';

beforeEach(() => vi.clearAllMocks());
afterEach(() => disconnect());
describe('CLI connection lifecycle', () => {
  it('reuses the connection within a CLI invocation', async () => {
    const first = getClient('http://localhost:3000/mcp');
    expect(await ensureConnected('http://localhost:3000/mcp')).toBe(first);
    expect(first.connect).toHaveBeenCalledOnce();
    expect(TKOClient).toHaveBeenCalledTimes(1);
  });
  it('disconnects once and creates a fresh client for the next invocation', async () => {
    const first = await ensureConnected('http://localhost:3000/mcp');
    await disconnect();
    await disconnect();
    expect(first.disconnect).toHaveBeenCalledOnce();
    const second = await ensureConnected('http://other:3000/mcp');
    expect(second).not.toBe(first);
    expect(TKOClient).toHaveBeenLastCalledWith('http://other:3000/mcp');
  });
  it('propagates connection failure and allows retry', async () => {
    const client = getClient('http://localhost:3000/mcp');
    vi.mocked(client.connect).mockRejectedValueOnce(new Error('offline'));
    await expect(ensureConnected('http://localhost:3000/mcp')).rejects.toThrow('offline');
    expect(await ensureConnected('http://localhost:3000/mcp')).toBe(client);
  });
});
