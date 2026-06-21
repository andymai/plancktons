import { describe, expect, it } from 'vitest';
import { contactGraph } from '../src/lib/contactGraph.js';
import { createRigidBody } from '../src/lib/rigidTet.js';

describe('contactGraph', () => {
  it('empty input yields all-zero coordination', () => {
    const r = contactGraph([], 1);
    expect(r.edgeCount).toBe(0);
    expect(r.meanContactCoordination).toBe(0);
    expect(r.maxContactCoordination).toBe(0);
    expect(r.perTet.length).toBe(0);
  });

  it('coincident tets register a single contact edge', () => {
    const a = createRigidBody(1, 'R', [0, 0, 0]);
    const b = createRigidBody(1, 'R', [0, 0, 0]);
    const r = contactGraph([a, b], 1);
    expect(r.edgeCount).toBe(1);
    expect(r.meanContactCoordination).toBe(1);
    expect(r.perTet[0]).toBe(1);
    expect(r.perTet[1]).toBe(1);
  });

  it('far-apart tets register no contacts', () => {
    const a = createRigidBody(1, 'R', [0, 0, 0]);
    const b = createRigidBody(1, 'R', [20, 0, 0]);
    const r = contactGraph([a, b], 1);
    expect(r.edgeCount).toBe(0);
    expect(r.maxContactCoordination).toBe(0);
  });

  it('a tight triangle of overlapping tets gives every tet a positive coordination', () => {
    const bodies = [
      createRigidBody(1, 'R', [0, 0, 0]),
      createRigidBody(1, 'L', [0.2, 0, 0]),
      createRigidBody(1, 'R', [0.1, 0.2, 0]),
    ];
    const r = contactGraph(bodies, 1);
    expect(r.edgeCount).toBeGreaterThan(0);
    for (const c of r.perTet) expect(c).toBeGreaterThan(0);
    expect(r.meanContactCoordination).toBeCloseTo((2 * r.edgeCount) / 3, 12);
  });
});
