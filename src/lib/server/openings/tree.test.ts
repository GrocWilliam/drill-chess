import { describe, expect, it } from 'vitest';
import { reachableAfterDelete } from './tree';

const m = (id: string, fromFen: string, toFen: string) => ({ id, fromFen, toFen });

describe('reachableAfterDelete', () => {
  it('removes the move and what only it reaches', () => {
    const moves = [m('1', 'S', 'A'), m('2', 'A', 'B'), m('3', 'S', 'C'), m('4', 'C', 'D')];
    expect(reachableAfterDelete(moves, 'S', '1').sort()).toEqual(['1', '2']);
  });
  it('keeps what stays reachable through a transposition', () => {
    const moves = [m('1', 'S', 'A'), m('2', 'A', 'P'), m('3', 'S', 'B'), m('4', 'B', 'P'), m('5', 'P', 'Q')];
    expect(reachableAfterDelete(moves, 'S', '2').sort()).toEqual(['2']);
  });
  it('is cycle-safe', () => {
    const moves = [m('1', 'S', 'A'), m('2', 'A', 'B'), m('3', 'B', 'A')];
    expect(reachableAfterDelete(moves, 'S', '1').sort()).toEqual(['1', '2', '3']);
  });
  it('is empty for an unknown id', () => {
    expect(reachableAfterDelete([m('1', 'S', 'A')], 'S', 'x')).toEqual([]);
  });
});
