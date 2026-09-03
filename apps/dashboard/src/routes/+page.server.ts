/**
 * Celluloplast Academy is an internal, single-tenant deployment: `/` has no public
 * academy landing page to render. It only boots the app so `landing.server.ts` can send
 * the visitor to their role home (or to `/login` when signed out).
 */
export const load = async () => ({});
