import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({ Client: vi.fn() }));
vi.mock('@modelcontextprotocol/sdk/client/streamable.js', () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));
vi.mock('../../../src/client/connection.js', () => ({ ensureConnected: vi.fn() }));
vi.mock('../../../src/config/loader.js', () => ({ loadConfig: vi.fn() }));
import { createCLI } from '../../../src/cli.js';
import { ensureConnected } from '../../../src/client/connection.js';
import { loadConfig } from '../../../src/config/loader.js';

const listTasks = vi.fn();
const config = {
  url: 'http://localhost:3000/mcp',
  outputFormat: 'json' as const,
  colorOutput: false,
  timeout: 30000,
};
async function run(args: string[] = []) {
  const cli = createCLI();
  const task = cli.commands.find((command) => command.name() === 'task')!;
  task.commands
    .find((command) => command.name() === 'list')!
    .exitOverride()
    .configureOutput({ writeErr: () => {} });
  await cli.parseAsync(['node', 'tko', 't', 'ls', ...args]);
}

describe('task list execution', () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockResolvedValue(config);
    vi.mocked(ensureConnected).mockResolvedValue({ listTasks } as unknown as Awaited<
      ReturnType<typeof ensureConnected>
    >);
    listTasks.mockResolvedValue({ tasks: [], count: 0 });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit 1');
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('excludes complete by default through the t ls aliases', async () => {
    await run();
    expect(listTasks).toHaveBeenCalledWith({ exclude_status: ['complete'] });
  });
  it('includes complete only when explicitly opted in', async () => {
    await run(['--includeStatus', 'complete']);
    expect(listTasks).toHaveBeenCalledWith({});
  });
  it('accepts trimmed comma-separated included statuses', async () => {
    await run(['--includeStatus', ' working, complete ,complete ']);
    expect(listTasks).toHaveBeenCalledWith({});
  });
  it('including an active status does not unhide complete', async () => {
    await run(['--includeStatus', 'idle']);
    expect(listTasks).toHaveBeenCalledWith({ exclude_status: ['complete'] });
  });
  it('requires opt-in even when --status requests complete', async () => {
    await run(['--status', 'complete']);
    expect(listTasks).toHaveBeenCalledWith({ status: 'complete', exclude_status: ['complete'] });
  });
  it('can list only complete tasks with both switches', async () => {
    await run(['--includeStatus', 'complete', '--status', 'complete']);
    expect(listTasks).toHaveBeenCalledWith({ status: 'complete' });
  });
  it('combines explicit exclusions with the default without duplicates', async () => {
    await run(['--status', ' idle, working ', '--excludeStatus', 'working, complete,working']);
    expect(listTasks).toHaveBeenCalledWith({
      status: ['idle', 'working'],
      exclude_status: ['complete', 'working'],
    });
  });
  it('explicit exclusion wins over inclusion', async () => {
    await run(['--includeStatus', 'complete', '--excludeStatus', 'complete']);
    expect(listTasks).toHaveBeenCalledWith({ exclude_status: ['complete'] });
  });
  it.each(['bogus', 'complete,bogus', ' , '])(
    'rejects invalid inclusion %s before connecting',
    async (value) => {
      await expect(run(['--includeStatus', value])).rejects.toThrow(/statuses/);
      expect(ensureConnected).not.toHaveBeenCalled();
    }
  );
  it('preserves pagination, hierarchy and archive filters', async () => {
    await run([
      '--assigned-to',
      'alice',
      '--queue',
      'dev',
      '--parent',
      '42',
      '--exclude-subtasks',
      '--include-archived',
      '--full',
      '--limit',
      '5',
      '--offset',
      '10',
    ]);
    expect(listTasks).toHaveBeenCalledWith({
      assigned_to: 'alice',
      queue_name: 'dev',
      parent_task_id: 42,
      exclude_subtasks: true,
      include_archived: true,
      include_description: true,
      limit: 5,
      offset: 10,
      exclude_status: ['complete'],
    });
  });
  it('projects fields from object responses using the real JSON formatter', async () => {
    listTasks.mockResolvedValue({
      tasks: [{ id: 1, title: 'Test', status: 'idle', description: 'large' }],
      count: 1,
    });
    await run(['--fields', 'id,status']);
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual([
      { id: 1, status: 'idle' },
    ]);
  });
  it('supports legacy array responses', async () => {
    listTasks.mockResolvedValue([{ id: 2, status: 'working' }]);
    await run();
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual([
      { id: 2, status: 'working' },
    ]);
  });
  it('prints the server-filtered total for table output', async () => {
    vi.mocked(loadConfig).mockResolvedValue({ ...config, outputFormat: 'table' });
    await run();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total: 0 task(s)'));
  });
  it('global JSON overrides command format', async () => {
    await run(['--json', '--format', 'csv']);
    expect(loadConfig).toHaveBeenCalledWith({ url: undefined, outputFormat: 'json' });
  });
  it('rejects invalid output formats without making a request', async () => {
    await expect(run(['--format', 'yaml'])).rejects.toThrow('exit 1');
    expect(listTasks).not.toHaveBeenCalled();
  });
  it('reports missing configuration without connecting', async () => {
    vi.mocked(loadConfig).mockResolvedValue({ ...config, url: undefined });
    await expect(run()).rejects.toThrow('exit 1');
    expect(ensureConnected).not.toHaveBeenCalled();
  });
  it.each([new Error('offline'), 'offline'])('reports request errors', async (error) => {
    listTasks.mockRejectedValue(error);
    await expect(run()).rejects.toThrow('exit 1');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error listing tasks:'),
      'offline'
    );
  });
});
