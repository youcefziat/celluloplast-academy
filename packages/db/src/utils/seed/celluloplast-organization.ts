import { and, db, eq, group, inArray, ne, or, organization, organizationmember, organizationPlan } from '@db/drizzle';

/** Primary demo org id (upstream TEST_ORG_ID — same row, Celluloplast branding). */
export const CELLULOPLAST_PRIMARY_ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289';

export const CELLULOPLAST_PRIMARY_ORG = {
  name: 'Celluloplast',
  siteName: 'celluloplast'
} as const;

/** Upstream demo profile ids — keep only primary-org membership for localhost recette. */
const CELLULOPLAST_DEMO_PROFILE_IDS = [
  '7ac00503-8519-43c8-a5ea-b79aeca900b1', // admin@test.com
  '0c256e75-aa40-4f62-8d30-0217ca1c60d9' // student@test.com
] as const;

/** Upstream seed slug kept for idempotent rename of existing local databases. */
export const LEGACY_PRIMARY_ORG_SITE_NAME = 'udemy-test';

/** Upstream multi-tenant demo orgs — not used in Celluloplast V1 single-tenant mode. */
export const CELLULOPLAST_UPSTREAM_DEMO_ORG_SITE_NAMES = ['coursera-test', 'skillshare-test'] as const;

/**
 * Celluloplast localhost: demo accounts should only belong to the primary org.
 * Upstream seed also attaches admin@test.com to Coursera Test as STUDENT, which
 * breaks single-tenant role resolution in the dashboard.
 */
export async function patchCelluloplastDemoMemberships(): Promise<void> {
  let totalRemoved = 0;

  for (const profileId of CELLULOPLAST_DEMO_PROFILE_IDS) {
    const rows = await db
      .delete(organizationmember)
      .where(
        and(
          eq(organizationmember.profileId, profileId),
          ne(organizationmember.organizationId, CELLULOPLAST_PRIMARY_ORG_ID)
        )
      )
      .returning({ id: organizationmember.id });

    totalRemoved += rows.length;
  }

  if (totalRemoved > 0) {
    console.log(`   ✓ Removed ${totalRemoved} cross-org demo membership(s)`);
  } else {
    console.log('   ✓ Demo memberships already scoped to primary org');
  }
}

/**
 * Idempotent Celluloplast patch: rename the primary demo org when it still uses upstream
 * "Udemy Test" branding. Safe to run after seed or on an existing localhost database.
 */
export async function patchCelluloplastPrimaryOrganization(): Promise<void> {
  const [existing] = await db
    .select({
      id: organization.id,
      name: organization.name,
      siteName: organization.siteName
    })
    .from(organization)
    .where(
      or(eq(organization.id, CELLULOPLAST_PRIMARY_ORG_ID), eq(organization.siteName, LEGACY_PRIMARY_ORG_SITE_NAME))
    )
    .limit(1);

  if (!existing) {
    console.log('   ✓ No legacy primary org to patch');
    return;
  }

  if (existing.name === CELLULOPLAST_PRIMARY_ORG.name && existing.siteName === CELLULOPLAST_PRIMARY_ORG.siteName) {
    console.log('   ✓ Celluloplast primary org already configured');
    return;
  }

  const [conflict] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(and(eq(organization.siteName, CELLULOPLAST_PRIMARY_ORG.siteName), ne(organization.id, existing.id)))
    .limit(1);

  if (conflict) {
    console.warn(
      '   ⚠ Skipped Celluloplast org patch: siteName "celluloplast" is already used by another organization'
    );
    return;
  }

  await db
    .update(organization)
    .set({
      name: CELLULOPLAST_PRIMARY_ORG.name,
      siteName: CELLULOPLAST_PRIMARY_ORG.siteName
    })
    .where(eq(organization.id, existing.id));

  console.log(
    `   ✓ Patched primary org "${existing.name}" (${existing.siteName ?? '—'}) → ${CELLULOPLAST_PRIMARY_ORG.name} (${CELLULOPLAST_PRIMARY_ORG.siteName})`
  );
}

/**
 * Remove upstream Coursera/Skillshare demo organizations from localhost databases.
 * Safe to run after seed or on an existing database (idempotent).
 */
export async function patchCelluloplastRemoveDemoOrganizations(): Promise<void> {
  const demoOrgs = await db
    .select({ id: organization.id, siteName: organization.siteName })
    .from(organization)
    .where(inArray(organization.siteName, [...CELLULOPLAST_UPSTREAM_DEMO_ORG_SITE_NAMES]));

  if (demoOrgs.length === 0) {
    console.log('   ✓ No upstream demo organizations to remove');
    return;
  }

  const demoOrgIds = demoOrgs.map((org) => org.id);

  await db.delete(organizationmember).where(inArray(organizationmember.organizationId, demoOrgIds));
  await db.delete(organizationPlan).where(inArray(organizationPlan.orgId, demoOrgIds));

  // Detach demo groups so organization rows can be removed without deep course-tree deletes.
  await db.update(group).set({ organizationId: null }).where(inArray(group.organizationId, demoOrgIds));

  const removed = await db
    .delete(organization)
    .where(inArray(organization.id, demoOrgIds))
    .returning({ siteName: organization.siteName });

  if (removed.length > 0) {
    const labels = removed.map((org) => org.siteName ?? 'unknown').join(', ');
    console.log(`   ✓ Removed ${removed.length} upstream demo organization(s): ${labels}`);
  }
}
