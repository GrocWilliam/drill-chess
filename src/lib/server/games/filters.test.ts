import { describe, expect, it } from 'vitest';
import { escapeLike, parseFilters, parsePage } from './filters';

describe('parseFilters', () => {
  it('keeps valid values and ignores unknown ones', () => {
    expect(parseFilters(new URLSearchParams('site=lichess&colour=green&time=blitz&opening=%25'))).toEqual({ site: 'lichess', timeClass: 'blitz', opening: '%' });
    expect(parseFilters(new URLSearchParams('site=foo&result=x'))).toEqual({});
  });
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('a%b_c\\')).toBe('a\\%b\\_c\\\\');
  });
});

describe('parsePage', () => {
  it.each([
    ['2', 2],
    ['0', 1],
    ['-3', 1],
    ['abc', 1],
    ['1e2', 1],
    [' 5', 1],
    ['100000000000000000000', 1],
    ['1000001', 1],
  ])('page=%j gives %i', (v, expected) => {
    expect(parsePage(new URLSearchParams({ page: v }))).toBe(expected);
  });
  it('defaults to 1', () => expect(parsePage(new URLSearchParams())).toBe(1));
});
