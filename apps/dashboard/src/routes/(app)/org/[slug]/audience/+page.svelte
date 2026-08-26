<script>
  import { AudiencePage } from '$features/audience/pages';
  import { t } from '$lib/utils/functions/translations';
  import * as Page from '@cio/ui/base/page';
  import { pageTitle } from '$lib/celluloplast/brand';

  let { data } = $props();
</script>

<svelte:head>
  <title>{pageTitle($t('audience.title'))}</title>
</svelte:head>

<Page.Root class="mx-auto w-full max-w-6xl">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('audience.title')}</Page.Title>
      <Page.Subtitle>{$t('audience.page_subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
    <!-- CSV import/export + plan caps: out of V1 (see CELLULOPLAST_V1.billing / Future Ideas). -->
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <AudiencePage audience={data.audience} pagination={data.pagination} query={data.query} courses={data.courses} />
    {/snippet}
  </Page.Body>
</Page.Root>
