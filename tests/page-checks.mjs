import fs from 'node:fs';
import YAML from 'yaml';
import { expect } from '@playwright/test';

const policy = YAML.parse(fs.readFileSync(new URL('../architecture/locales.yaml', import.meta.url), 'utf8'));
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/\[intlify\].*(Not found|Fall back)/i.test(message.text())) errors.push(message.text()); });
  return errors;
}
export async function layout(page, locale) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute('dir', policy.languages[locale].direction);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
