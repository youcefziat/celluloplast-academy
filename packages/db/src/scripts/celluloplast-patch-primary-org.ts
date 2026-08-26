import 'dotenv/config';

import {
  patchCelluloplastDemoMemberships,
  patchCelluloplastPrimaryOrganization,
  patchCelluloplastRemoveDemoOrganizations
} from '@db/utils/seed/celluloplast-organization';

async function main() {
  console.log('🔧 Celluloplast — patch primary organization');
  await patchCelluloplastPrimaryOrganization();
  await patchCelluloplastDemoMemberships();
  await patchCelluloplastRemoveDemoOrganizations();
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
