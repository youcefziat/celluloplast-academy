<script lang="ts">
  import { resolve } from '$app/paths';
  import { t } from '$lib/utils/functions/translations';
  import { APP_DISPLAY_NAME, DEFAULT_LOGO_PATH, appBrandFallback } from '$lib/celluloplast/brand';

  interface Props {
    logo: string | undefined;
    orgName: string | undefined;
  }

  let { logo, orgName }: Props = $props();
</script>

<div class="logo">
  <a
    href={resolve('/', {})}
    title={`${$t('navigation.goto')} ${appBrandFallback(orgName)} ${$t('navigation.home')}`}
    class="flex items-center gap-2"
    id="logo"
    data-hveid="8"
  >
    <img
      src={logo || DEFAULT_LOGO_PATH}
      alt={`${appBrandFallback(orgName)} logo`}
      class="mx-auto inline-block w-9 rounded"
      width="36"
      height="36"
    />
    {#if orgName}
      <span class="line-clamp-1 hidden text-sm font-medium md:block">{orgName}</span>
    {/if}
  </a>
</div>
