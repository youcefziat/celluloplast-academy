<script>
  import { AudiencePage } from '$features/audience/pages';
  import CreateAudienceMemberDialog from '$features/audience/components/create-audience-member-dialog.svelte';
  import { t } from '$lib/utils/functions/translations';
  import * as Page from '@cio/ui/base/page';
  import { Button } from '@cio/ui/base/button';
  import { pageTitle } from '$lib/celluloplast/brand';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { isOrgAdmin } from '$lib/utils/store/org';
  import UserPlusIcon from '@lucide/svelte/icons/user-plus';
  import UploadIcon from '@lucide/svelte/icons/upload';

  let { data } = $props();

  let createDialogOpen = $state(false);

  async function handleCreated() {
    await goto(page.url.pathname + page.url.search, {
      invalidateAll: true,
      noScroll: true,
      keepFocus: true
    });
  }
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
    {#if $isOrgAdmin}
      <Page.Action class="flex flex-wrap gap-2">
        <Button variant="outline" onclick={() => goto(resolve(`${page.url.pathname}/import`, {}))}>
          <UploadIcon class="size-4" />
          {$t('audience.import_users')}
        </Button>
        <Button onclick={() => (createDialogOpen = true)}>
          <UserPlusIcon class="size-4" />
          {$t('audience.create.open')}
        </Button>
      </Page.Action>
    {/if}
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <AudiencePage audience={data.audience} pagination={data.pagination} query={data.query} courses={data.courses} />
    {/snippet}
  </Page.Body>
</Page.Root>

{#if $isOrgAdmin}
  <CreateAudienceMemberDialog bind:open={createDialogOpen} managers={data.audience ?? []} onCreated={handleCreated} />
{/if}
