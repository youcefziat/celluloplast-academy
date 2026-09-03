<script lang="ts">
  import { onMount } from 'svelte';

  import { appInitApi } from '$features/app/init.svelte';
  import { Spinner } from '@cio/ui/base/spinner';
  import { Button } from '@cio/ui/base/button';
  import FrownIcon from '@lucide/svelte/icons/frown';
  import { Empty } from '@cio/ui/custom/empty';
  import { SimpleLogoNav } from '@cio/ui/custom/simple-logo-nav';
  import { APP_DISPLAY_NAME } from '$lib/celluloplast/brand';
  import { t } from '$lib/utils/functions/translations';

  let { data } = $props();

  const hasSetupError = $derived(!appInitApi.loading && !!appInitApi.error);

  onMount(() => {
    if (appInitApi.loading) return;

    appInitApi.setupApp(data.locals, { isOrgSite: false, orgSiteName: '' });
  });
</script>

<svelte:head>
  <title>{APP_DISPLAY_NAME}</title>
</svelte:head>

{#if hasSetupError}
  <Empty
    title={$t('app.setup_error.title')}
    description={$t('app.setup_error.description')}
    icon={FrownIcon}
    variant="page"
    layout="full-page"
    showLogo={true}
  >
    <p class="my-2 text-red-500">{appInitApi.error}</p>
    <Button variant="secondary" onclick={() => window.location.reload()}>{$t('app.setup_error.reload')}</Button>
  </Empty>
{:else}
  <div class="m-2 flex h-screen w-screen flex-col items-center justify-center font-sans sm:m-0">
    <SimpleLogoNav />
    <Spinner class="size-14! text-blue-700!" />
  </div>
{/if}
