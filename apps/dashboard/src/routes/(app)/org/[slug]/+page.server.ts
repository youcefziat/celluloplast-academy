import { redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
  // Celluloplast Academy V1: the org home is upstream's AI course creator, which is out of
  // scope. "Accueil" is the dashboard, so send every entry point (login, logo, root) there.
  // `*` is the placeholder the layout resolves client-side once the org is known.
  if (params.slug !== '*') {
    redirect(307, `/org/${params.slug}/dash`);
  }

  return {
    orgName: params.slug
  };
};
