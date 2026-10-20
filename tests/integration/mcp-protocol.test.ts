import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../src/server/mcp-server.js';
import { createTestClient, type TestClient } from '../helpers/test-client.js';

// Real MCP SDK request dispatch and real SQLite; no network or mocked services.
describe('MCP protocol workflows', () => {
  let db: TestClient;
  let client: Client;
  let server: ReturnType<typeof createMcpServer>;
  beforeEach(async () => {
    db = createTestClient();
    server = createMcpServer(db.taskService, db.commentService, db.linkService, db.queueService);
    client = new Client({ name: 'protocol-tests', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });
  afterEach(async () => {
    await client.close();
    await server.close();
    db.cleanup();
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    const content = result.content as { type: string; text: string }[];
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }
  const create = (title: string, extra = {}) =>
    call('create_task', { title, created_by: 'tester', ...extra });
  async function read(uri: string) {
    const result = await client.readResource({ uri });
    expect(result.contents[0].uri).toBe(uri);
    return result.contents[0].text as string;
  }

  it('advertises tools and resource templates', async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['list_tasks', 'get_task_history', 'move_comment', 'get_queue_tasks'])
    );
    expect((await client.listResources()).resources.map((r) => r.uri)).toContain('task://{id}');
  });
  it('creates, updates, retrieves, archives and deletes a task through MCP', async () => {
    const task = await create('Original');
    expect((await call('get_task', { id: task.id })).title).toBe('Original');
    await call('update_task', { id: task.id, title: 'Updated', status: 'complete' });
    expect((await call('get_task', { id: task.id })).status).toBe('complete');
    expect(JSON.stringify(await call('get_task_history', { task_id: task.id }))).toContain(
      'Updated'
    );
    await call('archive_task', { id: task.id });
    expect((await call('list_tasks')).tasks).toHaveLength(0);
    expect((await call('list_tasks', { include_archived: true })).tasks).toHaveLength(1);
    await call('delete_task', { id: task.id });
    expect(db.taskService.get(task.id)).toBeNull();
  });
  it('excludes complete before pagination while preserving the API default', async () => {
    const done = await create('Done', { priority: 100 });
    await call('update_task', { id: done.id, status: 'complete' });
    const first = await create('First', { priority: 20 });
    const second = await create('Second', { priority: 10 });
    const filtered = await call('list_tasks', {
      exclude_status: ['complete'],
      limit: 1,
      offset: 1,
    });
    expect(filtered.count).toBe(1);
    expect(filtered.tasks.map((t: { id: number }) => t.id)).toEqual([second.id]);
    expect((await call('list_tasks', { exclude_status: ['complete'], limit: 1 })).tasks[0].id).toBe(
      first.id
    );
    expect((await call('list_tasks')).tasks).toHaveLength(3);
    expect((await call('list_tasks', { status: 'complete' })).tasks[0].id).toBe(done.id);
  });
  it('round-trips comments and links and moves comments between tasks', async () => {
    const a = await create('A');
    const b = await create('B');
    const comment = await call('add_comment', { task_id: a.id, content: 'before' });
    await call('update_comment', { id: comment.id, content: 'after' });
    expect((await call('get_comment', { id: comment.id })).content).toBe('after');
    await call('move_comment', { comment_id: comment.id, to_task_id: b.id });
    expect((await call('list_comments', { task_id: a.id })).comments[0].content).toContain(
      'Comment moved to task'
    );
    expect((await call('list_comments', { task_id: b.id })).count).toBe(1);
    expect(await read(`task://${b.id}/comments`)).toContain('after');
    await call('delete_comment', { id: comment.id });
    const link = await call('add_link', { task_id: a.id, url: 'https://example.com/before' });
    await call('update_link', {
      id: link.id,
      url: 'https://example.com/after',
      description: 'artifact',
    });
    expect((await call('list_links', { task_id: a.id })).links[0].url).toBe(
      'https://example.com/after'
    );
    expect(await read(`task://${a.id}/links`)).toContain('artifact');
    await call('delete_link', { id: link.id });
    expect((await call('list_links', { task_id: a.id })).count).toBe(0);
  });
  it('moves subtasks and reads their hierarchy', async () => {
    const a = await create('A');
    const b = await create('B');
    const child = await call('create_subtask', {
      parent_task_id: a.id,
      title: 'Child',
      created_by: 'tester',
    });
    expect((await call('get_subtasks', { parent_task_id: a.id })).count).toBe(1);
    expect(
      (await call('get_task_with_subtasks', { task_id: a.id, recursive: true })).subtasks[0].id
    ).toBe(child.id);
    expect(await read(`task://hierarchy/${a.id}`)).toContain('Child');
    await call('move_subtask', { subtask_id: child.id, new_parent_id: b.id });
    expect((await call('get_subtasks', { parent_task_id: a.id })).count).toBe(0);
    expect(
      (await call('get_subtasks', { parent_task_id: b.id, recursive: true })).subtasks[0].id
    ).toBe(child.id);
    await call('move_subtask', { subtask_id: child.id });
    expect(db.taskService.get(child.id)?.parent_task_id).toBeNull();
  });
  it('routes queue operations and queue resources', async () => {
    const task = await create('Queued', { assigned_to: 'alice' });
    await call('add_task_to_queue', { task_id: task.id, queue_name: 'dev' });
    expect((await call('get_queue_tasks', { queue_name: 'dev' })).tasks[0].id).toBe(task.id);
    expect(JSON.stringify(await call('list_queues'))).toContain('dev');
    expect(JSON.stringify(await call('get_queue_stats', { queue_name: 'dev' }))).toContain('dev');
    expect((await call('get_my_queue', { agent_name: 'alice' })).tasks[0].id).toBe(task.id);
    for (const uri of [
      'queue://alice',
      'queue://alice/summary',
      'queue://list',
      'queue://stats/dev',
      'queue://tasks/dev',
    ]) {
      expect(await read(uri)).not.toBe('');
    }
    await call('move_task_to_queue', { task_id: task.id, new_queue_name: 'qa' });
    expect(db.taskService.get(task.id)?.queue_name).toBe('qa');
    await call('remove_task_from_queue', { task_id: task.id });
    expect(db.taskService.get(task.id)?.queue_name).toBeNull();
    await call('add_task_to_queue', { task_id: task.id, queue_name: 'qa' });
    await call('clear_queue', { queue_name: 'qa' });
    expect((await call('get_queue_tasks', { queue_name: 'qa' })).count).toBe(0);
  });
  it('claims an assigned task and transfers it with a handoff comment', async () => {
    const task = await create('Claim me', { assigned_to: 'alice' });
    expect((await call('signup_for_task', { agent_name: 'alice' })).id).toBe(task.id);
    expect(db.taskService.get(task.id)?.status).toBe('working');
    await call('move_task', {
      task_id: task.id,
      current_agent: 'alice',
      new_agent: 'bob',
      comment: 'Ready for QA',
    });
    expect(db.taskService.get(task.id)?.assigned_to).toBe('bob');
    expect(JSON.stringify(await call('list_comments', { task_id: task.id }))).toContain(
      'Ready for QA'
    );
    expect(await call('signup_for_task', { agent_name: 'nobody' })).toBeNull();
  });
  it('rejects a handoff by the wrong agent without changing ownership', async () => {
    const task = await create('Owned', { assigned_to: 'alice' });
    const result = await client.callTool({
      name: 'move_task',
      arguments: {
        task_id: task.id,
        current_agent: 'mallory',
        new_agent: 'bob',
        comment: 'Wrong owner',
      },
    });
    expect(result.isError).toBe(true);
    expect(db.taskService.get(task.id)?.assigned_to).toBe('alice');
  });
  it('reads task and active/archived task resources', async () => {
    const task = await create('Resource task');
    expect(JSON.parse(await read(`task://${task.id}`)).title).toBe('Resource task');
    expect(await read('tasks://active')).toContain('Resource task');
    await call('update_task', { id: task.id, status: 'complete' });
    await call('archive_task', { id: task.id });
    expect(await read('tasks://archived')).toContain('Resource task');
  });
  it.each([
    ['unknown_tool', {}],
    ['create_task', {}],
    ['update_task', { id: 999999, status: 'invalid' }],
    ['get_task', { id: 999999 }],
    ['create_subtask', { parent_task_id: 999999, title: 'Missing', created_by: 'tester' }],
  ])('returns an MCP error for %s invalid input', async (name, args) => {
    expect((await client.callTool({ name, arguments: args })).isError).toBe(true);
    expect(db.taskService.list()).toHaveLength(0);
  });
  it.each(['invalid://x', 'task://999999'])('returns resource errors for %s', async (uri) => {
    await expect(client.readResource({ uri })).rejects.toThrow();
  });
});
