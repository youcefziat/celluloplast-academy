<script lang="ts">
  import { Spinner } from '@cio/ui/base/spinner';
  import { APP_DISPLAY_NAME } from '$lib/celluloplast/brand';

  /**
   * Celluloplast Academy has no org home of its own: `+page.server.ts` redirects every real
   * slug to `/dash`, and the layout renders skeletons for the `*` placeholder. This component
   * only exists so the route resolves.
   */
</script>

<svelte:head>
  <title>{APP_DISPLAY_NAME}</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
  <Spinner class="size-10!" />
</div>
