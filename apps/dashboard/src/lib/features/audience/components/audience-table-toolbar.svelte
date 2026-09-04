<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { Search } from '@cio/ui/custom/search';
  import * as Page from '@cio/ui/base/page';
  import { t } from '$lib/utils/functions/translations';
  import { SortPopover } from '$features/ui';
  import * as Select from '@cio/ui/base/select';
  import { ROLE } from '@cio/utils/constants';
  import { ROLE_LABEL } from '$lib/utils/constants/roles';
  import type { OrganizationAudienceSortBy, OrganizationAudienceSortOrder } from '$features/org/utils/types';

  interface Props {
    hasSelection: boolean;
    selectedCount: number;
    searchValue?: string;
    sortBy: OrganizationAudienceSortBy;
    sortOrder: OrganizationAudienceSortOrder;
    onSortChange: (sortBy: OrganizationAudienceSortBy, sortOrder: OrganizationAudienceSortOrder) => void;
    onOpenAssign: () => void;
    /** 'all' clears the filter; otherwise a single role id as a string. */
    roleFilter?: string;
    onRoleFilterChange: (roleFilter: string) => void;
    /** 'all' clears the filter, else 'active' or 'pending'. */
    statusFilter?: string;
    onStatusFilterChange: (statusFilter: string) => void;
  }

  let {
    hasSelection,
    selectedCount,
    searchValue = $bindable(''),
    sortBy,
    sortOrder,
    onSortChange,
    onOpenAssign,
    roleFilter = 'all',
    onRoleFilterChange,
    statusFilter = 'all',
    onStatusFilterChange
  }: Props = $props();

  const roleOptions = [
    { label: t.get('audience.filter_all_roles'), value: 'all' },
    { label: t.get(ROLE_LABEL[ROLE.ADMIN]), value: String(ROLE.ADMIN) },
    { label: t.get(ROLE_LABEL[ROLE.TUTOR]), value: String(ROLE.TUTOR) },
    { label: t.get(ROLE_LABEL[ROLE.STUDENT]), value: String(ROLE.STUDENT) }
  ];

  const statusOptions = [
    { label: t.get('audience.filter_all_statuses'), value: 'all' },
    { label: t.get('audience.status_active'), value: 'active' },
    { label: t.get('audience.status_pending'), value: 'pending' }
  ];

  const roleFilterLabel = $derived(
    roleOptions.find((option) => option.value === roleFilter)?.label ?? roleOptions[0].label
  );
  const statusFilterLabel = $derived(
    statusOptions.find((option) => option.value === statusFilter)?.label ?? statusOptions[0].label
  );

  const sortOptions = [
    { label: t.get('audience.date_joined'), value: 'createdAt' },
    { label: t.get('audience.name'), value: 'name' },
    { label: t.get('audience.email'), value: 'email' }
  ];

  let localSortKey = $state(sortBy);
  let localSortOrder = $state(sortOrder);

  $effect(() => {
    localSortKey = sortBy;
    localSortOrder = sortOrder;
  });

  function handleSortKeyChange(key: string) {
    onSortChange(key as OrganizationAudienceSortBy, localSortOrder);
  }

  function handleOrderChange(order: 'asc' | 'desc') {
    onSortChange(localSortKey, order);
  }

  function handleClearSort() {
    onSortChange('createdAt', 'desc');
  }
</script>

<Page.BodyHeader>
  {#if hasSelection}
    <div class="flex items-center gap-3 rounded-md border px-4 py-2">
      <span class="ui:text-muted-foreground text-sm">
        {$t('audience.selected_count', { count: selectedCount })}
      </span>
      <Button variant="secondary" size="sm" onclick={onOpenAssign}>
        {$t('audience.assign_courses')}
      </Button>
    </div>
  {:else}
    <div class="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <Search placeholder={$t('audience.search_placeholder')} bind:value={searchValue} class="w-full md:max-w-sm" />
      <div class="flex flex-wrap items-center gap-2">
        <Select.Root type="single" value={roleFilter} onValueChange={onRoleFilterChange}>
          <Select.Trigger class="w-full sm:w-40" aria-label={$t('audience.role')}>
            {roleFilterLabel}
          </Select.Trigger>
          <Select.Content>
            {#each roleOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>

        <Select.Root type="single" value={statusFilter} onValueChange={onStatusFilterChange}>
          <Select.Trigger class="w-full sm:w-40" aria-label={$t('audience.status')}>
            {statusFilterLabel}
          </Select.Trigger>
          <Select.Content>
            {#each statusOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>

        <SortPopover
          {sortOptions}
          bind:sortKey={localSortKey}
          bind:selectedOrder={localSortOrder}
          defaultSortKey="createdAt"
          defaultSortOrder="desc"
          onSortKeyChange={handleSortKeyChange}
          onOrderChange={handleOrderChange}
          onClearFilters={handleClearSort}
        />
      </div>
    </div>
  {/if}
</Page.BodyHeader>
