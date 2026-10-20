import { describe, expect, it } from 'vitest';
import { TreeFormatter } from '../../../src/formatters/tree.js';
import { StatsFormatter } from '../../../src/formatters/stats.js';

describe.each([false, true])('hierarchy and stats (color=%s)', (color) => {
  it('renders nested siblings, assignments, queues, priorities and blockers', () => {
    const output = new TreeFormatter({ color }).format({
      id: 1,
      title: 'Epic',
      status: 'idle',
      assigned_to: 'alice',
      queue_name: 'dev',
      priority: 9,
      subtasks: [
        {
          id: 2,
          title: 'First',
          status: 'working',
          priority: 2,
          blocked_by_task_id: 99,
          subtasks: [{ id: 4, title: 'Nested', status: 'custom', priority: 0 }],
        },
        { id: 3, title: 'Last', status: 'complete' },
      ],
    });
    for (const text of [
      'Task #1:',
      'Epic',
      'alice',
      'dev',
      'P9',
      'First',
      'P2',
      'blocked:#99',
      'Nested',
      'custom',
      'Last',
      'unassigned',
      'working',
      'complete',
    ]) {
      expect(output).toContain(text);
    }
    expect(output).toContain('├──');
    expect(output).toContain('│   ');
    expect(output).not.toContain('P0');
    expect(output.split('\n')).toHaveLength(4);
  });
  it('renders a leaf without optional fields', () => {
    expect(new TreeFormatter({ color }).format({ id: 1, title: 'Leaf' })).toContain('unassigned');
  });
  it('renders queue totals, status breakdown and agents', () => {
    const output = new StatsFormatter({ color }).format({
      queue_name: 'qa',
      total_tasks: 6,
      idle_tasks: 1,
      working_tasks: 2,
      complete_tasks: 3,
      assigned_tasks: 4,
      unassigned_tasks: 2,
      agents: ['alice', 'bob'],
    });
    expect(output).toContain('Queue: qa');
    for (const label of [
      'Total Tasks:',
      'Idle:',
      'Working:',
      'Complete:',
      'Assigned:',
      'Unassigned:',
    ])
      expect(output).toContain(label);
    expect(output).toMatch(/Total Tasks:\s+6/);
    expect(output).toContain('alice, bob');
  });
  it('handles an empty queue without phantom status or agent rows', () => {
    const output = new StatsFormatter({ color }).format({
      queue_name: 'empty',
      total_tasks: 0,
      assigned_tasks: 0,
      unassigned_tasks: 0,
    });
    expect(output).toMatch(/Total Tasks:\s+0/);
    expect(output).not.toContain('Idle:');
    expect(output).not.toContain('Agents:');
  });
  it.each([null, undefined, 'invalid'])('rejects non-object input %s', (input) => {
    expect(new TreeFormatter({ color }).format(input)).toContain('Invalid task data');
    expect(new StatsFormatter({ color }).format(input)).toContain('Invalid stats data');
  });
});
