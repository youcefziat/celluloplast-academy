import { redirect } from '@sveltejs/kit';

/**
 * Upstream's course home is the news feed, which is out of scope for Celluloplast Academy.
 * Every entry point (sidebar, breadcrumbs, old links) lands on the content tab instead.
 */
export const load = ({ params }) => {
  redirect(307, `/courses/${params.id}/lessons`);
};
