/**
 * cPanel → Office 365 mailbox migration (coexistence period, cPanel as internal relay).
 *
 * Some @celluloplast.com mailboxes are only reachable, right now, through the O365 tenant
 * domain: Hostinger accepts the message (250 Ok) and it is never delivered. When the caller
 * opts in, the invite email is delivered to the tenant address instead.
 *
 * The account identity is never touched — login, database and display all keep the entered
 * address. Only the SMTP `to` of that one invite email changes.
 *
 * This is temporary. Every invite path routes through this module so that deleting it, once
 * the DNS have converged, is a single change rather than a hunt across services.
 */
const OFFICE_365_TENANT_DOMAIN = 'celluloplast.onmicrosoft.com';

/** The domain still mid-migration; only these addresses can need the override. */
const MIGRATING_MAIL_DOMAIN = 'celluloplast.com';

function readEmailDomain(email: string): string {
  return email.split('@')[1]?.trim().toLowerCase() ?? '';
}

/**
 * Whether an address is on the migrating domain, so the UI can surface the option only where
 * it can apply instead of asking every operator to know about the migration.
 */
export function isOffice365MigrationCandidate(email: string): boolean {
  return readEmailDomain(email) === MIGRATING_MAIL_DOMAIN;
}

export function toOffice365DeliveryEmail(email: string): string {
  const localPart = email.split('@')[0];

  return `${localPart}@${OFFICE_365_TENANT_DOMAIN}`;
}

/**
 * Where a single invite must be delivered. Falls back to the account address whenever the
 * override is off or the address is not on the migrating domain, so a stray `true` from a
 * caller can never redirect an unrelated mailbox.
 */
export function resolveInviteDeliveryEmail(email: string, useOffice365: boolean): string {
  if (!useOffice365 || !isOffice365MigrationCandidate(email)) {
    return email;
  }

  return toOffice365DeliveryEmail(email);
}

/**
 * Bulk form of {@link resolveInviteDeliveryEmail}, keyed by the lowercased account email.
 * Returns undefined when no address needs redirecting, so callers can skip the override
 * entirely rather than pass an empty map around.
 */
export function buildDeliveryEmailOverrides(emails: string[], useOffice365: boolean): Map<string, string> | undefined {
  if (!useOffice365) {
    return undefined;
  }

  const overrides = new Map<string, string>();

  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase();
    const deliveryEmail = resolveInviteDeliveryEmail(normalizedEmail, true);

    if (deliveryEmail !== normalizedEmail) {
      overrides.set(normalizedEmail, deliveryEmail);
    }
  }

  return overrides.size > 0 ? overrides : undefined;
}
