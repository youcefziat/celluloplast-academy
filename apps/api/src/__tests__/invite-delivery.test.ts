import { describe, expect, it } from 'vitest';

import {
  buildDeliveryEmailOverrides,
  isOffice365MigrationCandidate,
  resolveInviteDeliveryEmail,
  toOffice365DeliveryEmail
} from '../services/organization/invite-delivery';

describe('isOffice365MigrationCandidate', () => {
  it('matches the migrating domain, case-insensitively', () => {
    expect(isOffice365MigrationCandidate('dzziyo@celluloplast.com')).toBe(true);
    expect(isOffice365MigrationCandidate('DZZIYO@Celluloplast.COM')).toBe(true);
  });

  it('rejects every other domain, including the tenant one', () => {
    expect(isOffice365MigrationCandidate('someone@gmail.com')).toBe(false);
    expect(isOffice365MigrationCandidate('someone@celluloplast.onmicrosoft.com')).toBe(false);
    expect(isOffice365MigrationCandidate('someone@sub.celluloplast.com')).toBe(false);
    expect(isOffice365MigrationCandidate('not-an-email')).toBe(false);
  });
});

describe('toOffice365DeliveryEmail', () => {
  it('keeps the local part and swaps in the tenant domain', () => {
    expect(toOffice365DeliveryEmail('dzziyo@celluloplast.com')).toBe('dzziyo@celluloplast.onmicrosoft.com');
  });
});

describe('resolveInviteDeliveryEmail', () => {
  it('redirects a migrating mailbox when the option is on', () => {
    expect(resolveInviteDeliveryEmail('dzziyo@celluloplast.com', true)).toBe('dzziyo@celluloplast.onmicrosoft.com');
  });

  it('leaves the address alone when the option is off', () => {
    expect(resolveInviteDeliveryEmail('dzziyo@celluloplast.com', false)).toBe('dzziyo@celluloplast.com');
  });

  it('never redirects an address outside the migrating domain, even when asked', () => {
    expect(resolveInviteDeliveryEmail('someone@gmail.com', true)).toBe('someone@gmail.com');
  });
});

describe('buildDeliveryEmailOverrides', () => {
  it('returns undefined when the option is off', () => {
    expect(buildDeliveryEmailOverrides(['dzziyo@celluloplast.com'], false)).toBeUndefined();
  });

  it('returns undefined when no address needs redirecting', () => {
    expect(buildDeliveryEmailOverrides(['someone@gmail.com'], true)).toBeUndefined();
  });

  it('maps only the migrating addresses, keyed by the lowercased account email', () => {
    const overrides = buildDeliveryEmailOverrides(['  DZZIYO@Celluloplast.com ', 'someone@gmail.com'], true);

    expect(overrides).toEqual(new Map([['dzziyo@celluloplast.com', 'dzziyo@celluloplast.onmicrosoft.com']]));
  });
});
