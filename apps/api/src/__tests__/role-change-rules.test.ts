import { describe, expect, it } from 'vitest';

import { assertRoleChangeAllowed } from '../services/organization/role-rules';
import { ROLE } from '@cio/utils/constants';

const ACTOR = 'actor-profile-id';
const OTHER = 'another-profile-id';

describe('assertRoleChangeAllowed', () => {
  it('allows demoting a tutor or a student regardless of admin count', () => {
    expect(() =>
      assertRoleChangeAllowed({
        currentRoleId: ROLE.TUTOR,
        memberProfileId: OTHER,
        actorProfileId: ACTOR,
        adminCount: 1
      })
    ).not.toThrow();

    expect(() =>
      assertRoleChangeAllowed({
        currentRoleId: ROLE.STUDENT,
        memberProfileId: ACTOR,
        actorProfileId: ACTOR,
        adminCount: 0
      })
    ).not.toThrow();
  });

  it('refuses to let an admin change their own role', () => {
    expect(() =>
      assertRoleChangeAllowed({
        currentRoleId: ROLE.ADMIN,
        memberProfileId: ACTOR,
        actorProfileId: ACTOR,
        adminCount: 5
      })
    ).toThrow(/your own admin role/i);
  });

  it('refuses to demote the last remaining admin', () => {
    expect(() =>
      assertRoleChangeAllowed({
        currentRoleId: ROLE.ADMIN,
        memberProfileId: OTHER,
        actorProfileId: ACTOR,
        adminCount: 1
      })
    ).toThrow(/at least one admin/i);
  });

  it('allows demoting another admin when others remain', () => {
    expect(() =>
      assertRoleChangeAllowed({
        currentRoleId: ROLE.ADMIN,
        memberProfileId: OTHER,
        actorProfileId: ACTOR,
        adminCount: 2
      })
    ).not.toThrow();
  });

  it('still guards a pending admin invite that has no profile yet', () => {
    // memberProfileId is null before the invite is accepted, so the self-demotion rule cannot
    // match; the last-admin rule must still apply.
    expect(() =>
      assertRoleChangeAllowed({
        currentRoleId: ROLE.ADMIN,
        memberProfileId: null,
        actorProfileId: ACTOR,
        adminCount: 1
      })
    ).toThrow(/at least one admin/i);
  });
});
