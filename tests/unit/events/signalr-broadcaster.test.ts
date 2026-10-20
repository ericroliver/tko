import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const connection = {
    state: 'Disconnected',
    baseUrl: 'http://hub/messagehub',
    start: vi.fn(),
    stop: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    onclose: vi.fn(),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
  };
  const builder = {
    withUrl: vi.fn(),
    withAutomaticReconnect: vi.fn(),
    configureLogging: vi.fn(),
    build: vi.fn(),
  };
  return { connection, builder };
});
vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: vi.fn(() => mocks.builder),
  HubConnectionState: { Connected: 'Connected' },
  LogLevel: { Information: 1, Warning: 2, Error: 3 },
}));
vi.mock('../../../src/utils/index.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
import { SignalRBroadcaster } from '../../../src/events/signalr-broadcaster.js';
import { createEvent, TaskEventType } from '../../../src/events/event-types.js';
const event = (id: number) => createEvent(TaskEventType.TaskCreated, { taskId: id });
const c = mocks.connection;
let broadcaster: SignalRBroadcaster;
function make(options: Partial<ConstructorParameters<typeof SignalRBroadcaster>[0]> = {}) {
  broadcaster = new SignalRBroadcaster({ hubUrl: c.baseUrl, ...options });
  return broadcaster;
}
async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  vi.clearAllMocks();
  c.start.mockReset();
  c.stop.mockReset();
  c.invoke.mockReset();
  c.state = 'Disconnected';
  mocks.builder.withUrl.mockReturnThis();
  mocks.builder.withAutomaticReconnect.mockReturnThis();
  mocks.builder.configureLogging.mockReturnThis();
  mocks.builder.build.mockReturnValue(c);
  c.start.mockImplementation(async () => {
    c.state = 'Connected';
  });
  c.stop.mockImplementation(async () => {
    c.state = 'Disconnected';
  });
  c.invoke.mockResolvedValue(undefined);
});
afterEach(async () => {
  await broadcaster?.stop();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('SignalR delivery and lifecycle', () => {
  it('connects once and broadcasts without a group', async () => {
    make();
    await broadcaster.start();
    await broadcaster.start();
    expect(c.start).toHaveBeenCalledTimes(1);
    expect(broadcaster.isConnected).toBe(true);
    const message = event(1);
    broadcaster.broadcast(message);
    await flush();
    expect(c.invoke).toHaveBeenCalledWith('BroadcastMessage', message);
  });
  it('joins a configured group and rejoins after reconnect', async () => {
    make({ group: 'agents', logLevel: 'Warning' });
    await broadcaster.start();
    broadcaster.broadcast(event(1));
    await flush();
    expect(c.invoke).toHaveBeenCalledWith('JoinGroup', 'agents');
    expect(c.invoke).toHaveBeenCalledWith(
      'SendToGroup',
      'agents',
      expect.objectContaining({ payload: { taskId: 1 } })
    );
    await c.onreconnected.mock.calls[0][0]('new-id');
    expect(c.invoke.mock.calls.filter(([name]) => name === 'JoinGroup')).toHaveLength(2);
  });
  it('bounds the disconnected queue by dropping the oldest message', async () => {
    make({ maxQueueSize: 2 });
    broadcaster.broadcast(event(1));
    broadcaster.broadcast(event(2));
    broadcaster.broadcast(event(3));
    expect(broadcaster.queueLength).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.invoke).not.toHaveBeenCalled();
    await broadcaster.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.invoke.mock.calls.map(([, message]) => message.payload.taskId)).toEqual([2, 3]);
    expect(broadcaster.queueLength).toBe(0);
  });
  it('requeues a failed immediate send and later delivers it', async () => {
    make();
    await broadcaster.start();
    c.invoke.mockRejectedValueOnce(new Error('offline'));
    broadcaster.broadcast(event(1));
    await flush();
    expect(broadcaster.queueLength).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.invoke).toHaveBeenCalledTimes(2);
    expect(broadcaster.queueLength).toBe(0);
  });
  it('keeps queued messages in order after a drain failure', async () => {
    make();
    broadcaster.broadcast(event(1));
    broadcaster.broadcast(event(2));
    await broadcaster.start();
    c.invoke.mockRejectedValueOnce('failed');
    await vi.advanceTimersByTimeAsync(1000);
    expect(broadcaster.queueLength).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.invoke.mock.calls.map(([, message]) => message.payload.taskId)).toEqual([1, 1, 2]);
  });
  it.each([
    { rateLimitBurst: 1, rateLimitPerMinute: 60, delay: 10000 },
    { rateLimitBurst: 10, rateLimitPerMinute: 1, delay: 60000 },
  ])('drains after the rate window expires: %o', async ({ delay, ...options }) => {
    make(options);
    await broadcaster.start();
    broadcaster.broadcast(event(1));
    await flush();
    broadcaster.broadcast(event(2));
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(c.invoke).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(c.invoke).toHaveBeenCalledTimes(2);
    expect(broadcaster.queueLength).toBe(0);
  });
  it('retries initial connection failures until successful', async () => {
    make({ reconnectDelay: 50, group: 'agents', logLevel: 'Error' });
    c.start
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce('still unavailable');
    await broadcaster.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(c.start).toHaveBeenCalledTimes(3);
    expect(c.invoke).toHaveBeenCalledWith('JoinGroup', 'agents');
  });
  it('deduplicates close-triggered retries and cancels them on stop', async () => {
    make({ reconnectDelay: 50 });
    await broadcaster.start();
    const close = c.onclose.mock.calls[0][0];
    close(new Error('closed'));
    close();
    await broadcaster.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.start).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    close();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not throw when stopping or rejoining fails', async () => {
    make({ group: 'agents' });
    await broadcaster.start();
    c.invoke.mockRejectedValueOnce(new Error('group unavailable'));
    await expect(c.onreconnected.mock.calls[0][0]('id')).resolves.toBeUndefined();
    c.stop.mockRejectedValueOnce('stop failed');
    await expect(broadcaster.stop()).resolves.toBeUndefined();
  });
  it('handles hub error notifications and reconnecting callbacks', () => {
    make();
    const handlers = Object.fromEntries(c.on.mock.calls);
    expect(() => handlers.ValidationError({ Error: 'invalid', Details: ['type'] })).not.toThrow();
    expect(() => handlers.Error({ Message: 'rate limit exceeded' })).not.toThrow();
    expect(() => handlers.Error({ Message: 'other error' })).not.toThrow();
    expect(() => handlers.Error({ reason: 'unknown' })).not.toThrow();
    c.onreconnecting.mock.calls[0][0](new Error('lost'));
    c.onreconnecting.mock.calls[0][0]();
    expect(vi.getTimerCount()).toBe(1);
  });
});
