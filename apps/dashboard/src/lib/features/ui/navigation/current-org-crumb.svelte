<script lang="ts">
  import * as Avatar from '@cio/ui/base/avatar';
  import * as Breadcrumb from '@cio/ui/base/breadcrumb';
  import { Skeleton } from '@cio/ui/base/skeleton';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { shortenName } from '$lib/utils/functions/string';

  /**
   * Celluloplast Academy runs a single internal organization, so the first breadcrumb is a
   * plain link home rather than upstream's organization switcher.
   */
</script>

<Breadcrumb.Link href={$currentOrgPath} class="flex items-center gap-2">
  {#if $currentOrg.name}
    <Avatar.Root class="flex size-6! items-center justify-center rounded-md!">
      <Avatar.Image src={$currentOrg.avatarUrl} alt={$currentOrg.name} />
      <Avatar.Fallback class="rounded-md! text-xs">{shortenName($currentOrg.name)}</Avatar.Fallback>
    </Avatar.Root>
    <span class="hidden truncate text-sm font-medium md:block">{$currentOrg.name}</span>
  {:else}
    <Skeleton class="h-4 w-24" />
  {/if}
</Breadcrumb.Link>
