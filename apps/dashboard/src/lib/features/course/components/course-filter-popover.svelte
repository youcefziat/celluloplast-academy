<script lang="ts">
  import {
    COURSE_SORT_OPTIONS,
    DEFAULT_COURSE_SORT,
    DEFAULT_SORT_ORDER,
    type CourseSortBy,
    type CourseSortOrder
  } from '../utils/constants';
  import { Button } from '@cio/ui/base/button';
  import { SortPopover } from '$features/ui';
  import { t } from '$lib/utils/functions/translations';

  type SortOption = (typeof COURSE_SORT_OPTIONS)[number];

  interface Props {
    sortKey?: CourseSortBy;
    selectedOrder?: CourseSortOrder;
    sortOptions?: readonly SortOption[];
    isFiltering?: boolean;
    hasActiveFilters?: boolean;
    publishedStatus?: 'all' | 'published' | 'unpublished';
    courseType?: string;
    courseTypeOptions?: { value: string; label: string }[];
    onClearFilters?: () => void | Promise<void>;
    onPublishedStatusChange?: (status: 'all' | 'published' | 'unpublished') => void;
    onCourseTypeChange?: (type: string) => void;
  }

  let {
    sortKey = $bindable(DEFAULT_COURSE_SORT),
    selectedOrder = $bindable(DEFAULT_SORT_ORDER),
    sortOptions = COURSE_SORT_OPTIONS,
    isFiltering = false,
    hasActiveFilters: hasActiveFiltersOverride = undefined,
    publishedStatus = $bindable('all'),
    courseType = $bindable('all'),
    courseTypeOptions = [],
    onClearFilters = () => {},
    onPublishedStatusChange,
    onCourseTypeChange
  }: Props = $props();

  const translatedSortOptions = $derived(
    sortOptions.map((option) => ({ value: option.value, label: $t(option.label) }))
  );

  const hasActiveFilters = $derived(
    hasActiveFiltersOverride !== undefined
      ? hasActiveFiltersOverride
      : sortKey !== DEFAULT_COURSE_SORT ||
          selectedOrder !== DEFAULT_SORT_ORDER ||
          publishedStatus !== 'all' ||
          courseType !== 'all'
  );

  function setPublishedStatus(status: 'all' | 'published' | 'unpublished') {
    publishedStatus = status;
    onPublishedStatusChange?.(status);
  }

  function setCourseType(type: string) {
    courseType = type;
    onCourseTypeChange?.(type);
  }
</script>

<SortPopover
  sortOptions={translatedSortOptions}
  bind:sortKey
  bind:selectedOrder
  defaultSortKey={DEFAULT_COURSE_SORT}
  defaultSortOrder={DEFAULT_SORT_ORDER}
  {isFiltering}
  {hasActiveFilters}
  {onClearFilters}
>
  {#snippet additionalContent()}
    <div class="space-y-3">
      <div class="space-y-2">
        <p class="ui:text-muted-foreground text-xs font-semibold uppercase">{$t('widgets.filter.status')}</p>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={publishedStatus === 'all' ? 'secondary' : 'outline'}
            onclick={() => setPublishedStatus('all')}>{$t('widgets.filter.all')}</Button
          >
          <Button
            type="button"
            size="sm"
            variant={publishedStatus === 'published' ? 'secondary' : 'outline'}
            onclick={() => setPublishedStatus('published')}>{$t('widgets.status.published')}</Button
          >
          <Button
            type="button"
            size="sm"
            variant={publishedStatus === 'unpublished' ? 'secondary' : 'outline'}
            onclick={() => setPublishedStatus('unpublished')}>{$t('widgets.filter.unpublished')}</Button
          >
        </div>
      </div>

      {#if courseTypeOptions.length > 0}
        <div class="space-y-2">
          <p class="ui:text-muted-foreground text-xs font-semibold uppercase">{$t('widgets.filter.course_type')}</p>
          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={courseType === 'all' ? 'secondary' : 'outline'}
              onclick={() => setCourseType('all')}>{$t('widgets.filter.all')}</Button
            >
            {#each courseTypeOptions as opt (opt.value)}
              <Button
                type="button"
                size="sm"
                variant={courseType === opt.value ? 'secondary' : 'outline'}
                onclick={() => setCourseType(opt.value)}>{opt.label}</Button
              >
            {/each}
          </div>
        </div>
      {/if}

      {#if courseTypeOptions.length === 0 && publishedStatus === undefined}
        <p class="ui:text-muted-foreground text-sm">{$t('courses.tag_filters.empty_tags')}</p>
      {/if}
    </div>
  {/snippet}
</SortPopover>
