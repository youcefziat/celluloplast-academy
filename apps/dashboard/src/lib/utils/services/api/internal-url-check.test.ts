import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getPrivateServerUrlMisconfiguration } from './internal-url-check';

const ENV_KEYS = ['PRIVATE_SERVER_URL', 'ORIGIN', 'DASHBOARD_ORIGIN'] as const;

describe('getPrivateServerUrlMisconfiguration', () => {
  const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it('accepts the internal API container address', () => {
    process.env.PRIVATE_SERVER_URL = 'http://api:3081';
    process.env.ORIGIN = 'https://academy.celluloapps.com';

    expect(getPrivateServerUrlMisconfiguration()).toBeNull();
  });

  it('rejects the dashboard origin, the loop that hangs every render', () => {
    process.env.PRIVATE_SERVER_URL = 'https://academy.celluloapps.com';
    process.env.ORIGIN = 'https://academy.celluloapps.com';

    expect(getPrivateServerUrlMisconfiguration()).toContain('points at the dashboard itself');
  });

  it('matches on origin, ignoring path and trailing slash', () => {
    process.env.PRIVATE_SERVER_URL = 'https://academy.celluloapps.com/';
    process.env.ORIGIN = 'https://academy.celluloapps.com';

    expect(getPrivateServerUrlMisconfiguration()).toContain('points at the dashboard itself');
  });

  it('also catches the loop when only DASHBOARD_ORIGIN is set', () => {
    process.env.PRIVATE_SERVER_URL = 'https://academy.celluloapps.com';
    process.env.DASHBOARD_ORIGIN = 'https://academy.celluloapps.com';

    expect(getPrivateServerUrlMisconfiguration()).toContain('points at the dashboard itself');
  });

  it('allows a different host on the same public scheme', () => {
    process.env.PRIVATE_SERVER_URL = 'https://api.celluloapps.com';
    process.env.ORIGIN = 'https://academy.celluloapps.com';

    expect(getPrivateServerUrlMisconfiguration()).toBeNull();
  });

  it('reports a missing variable', () => {
    process.env.ORIGIN = 'https://academy.celluloapps.com';

    expect(getPrivateServerUrlMisconfiguration()).toContain('is not set');
  });

  it('reports an unparseable value', () => {
    process.env.PRIVATE_SERVER_URL = 'api:3081';
    process.env.ORIGIN = 'https://academy.celluloapps.com';

    expect(getPrivateServerUrlMisconfiguration()).toContain('not a valid URL');
  });
});
