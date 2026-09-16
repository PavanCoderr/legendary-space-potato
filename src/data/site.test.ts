import { describe, expect, it } from 'vitest';
import { version } from '../../package.json';
import { SITE } from './site';

describe('SITE metadata', () => {
  it('displays the version that is actually in package.json', () => {
    expect(SITE.version).toBe(version);
  });
});
