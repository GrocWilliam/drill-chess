import { describe, expect, test } from 'vitest';
import en from './en.json';
import fr from './fr.json';
import { formatOneDecimal, pickLang, pickTheme, translate, translatePlural } from './index';

test('formatOneDecimal', () => {
  expect(formatOneDecimal(87.3, 'en')).toBe('87.3');
  expect(formatOneDecimal(100, 'en')).toBe('100.0');
  expect(formatOneDecimal(87.3, 'fr')).toBe('87,3');
});

describe('pickLang', () => {
  test('first language only', () => {
    expect(pickLang('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(pickLang('de-DE,fr;q=0.9')).toBe('en');
    expect(pickLang(null)).toBe('en');
  });
  test('cookie overrides, invalid ignored', () => {
    expect(pickLang('fr', 'en')).toBe('en');
    expect(pickLang('en', 'fr')).toBe('fr');
    expect(pickLang('fr', 'xx')).toBe('fr');
  });
});

test('pickTheme', () => {
  expect(pickTheme('dark')).toBe('dark');
  expect(pickTheme('system')).toBeNull();
  expect(pickTheme(undefined)).toBeNull();
});

test('translate', () => {
  expect(translate({ a: 'Hi {n}' }, 'a', { n: 2 })).toBe('Hi 2');
  expect(translate({}, 'missing')).toBe('missing');
});

test('catalogs have the same keys', () => {
  expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
});

test('the openings home counts have both plural forms in each language', () => {
  for (const catalog of [en, fr]) {
    for (const key of ['positions', 'due', 'learned']) {
      expect(catalog).toHaveProperty(`openings.home.${key}_one`);
      expect(catalog).toHaveProperty(`openings.home.${key}_other`);
    }
  }
  expect(translatePlural(fr, 'fr', 'openings.home.due', 2)).toBe("2 à revoir aujourd'hui");
  expect(translatePlural(en, 'en', 'openings.home.positions', 1)).toBe('1 position');
});
