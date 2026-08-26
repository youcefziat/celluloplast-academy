import { db, organization } from '@db/drizzle';

import {
  CELLULOPLAST_PRIMARY_ORG,
  patchCelluloplastDemoMemberships,
  patchCelluloplastPrimaryOrganization,
  patchCelluloplastRemoveDemoOrganizations
} from './celluloplast-organization';

export async function seedOrganization({
  testOrgId,

  enterpriseOrgId: _enterpriseOrgId,

  earlyAdopterOrgId: _earlyAdopterOrgId
}: {
  testOrgId: string;

  enterpriseOrgId: string;

  earlyAdopterOrgId: string;
}) {
  const existingOrgs = await db.select().from(organization);

  const existingOrgIds = existingOrgs.map((org) => org.id);

  const organizationsToInsert = [
    {
      id: testOrgId,

      name: CELLULOPLAST_PRIMARY_ORG.name,

      siteName: CELLULOPLAST_PRIMARY_ORG.siteName,

      settings: {},

      landingpage: {},

      theme: '',

      customization: {
        apps: { poll: true, comments: true },

        course: { grading: true, newsfeed: true },

        dashboard: { exercise: true, community: true, bannerText: '', bannerImage: '' }
      }
    }
  ].filter((org) => !existingOrgIds.includes(org.id));

  if (organizationsToInsert.length > 0) {
    await db.insert(organization).values(organizationsToInsert);

    console.log(`   ✓ Inserted ${organizationsToInsert.length} organization(s)`);
  } else {
    console.log('   ✓ Organizations already exist, skipping');
  }

  await patchCelluloplastPrimaryOrganization();

  await patchCelluloplastDemoMemberships();

  await patchCelluloplastRemoveDemoOrganizations();
}
