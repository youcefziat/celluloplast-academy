<script lang="ts">
  import * as Card from '@cio/ui/base/card';
  import * as Table from '@cio/ui/base/table';
  import { Badge } from '@cio/ui/base/badge';
  import { Empty } from '@cio/ui/custom/empty';
  import { UserAvatar } from '@cio/ui/custom/user-avatar';
  import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
  import { t } from '$lib/utils/functions/translations';
  import type { LearningOverviewLearner, LearningProgressStatus } from '../utils/types';

  interface Props {
    rows: LearningOverviewLearner[];
  }

  let { rows }: Props = $props();

  const statusTone: Record<LearningProgressStatus, string> = {
    NOT_STARTED: 'ui:bg-muted ui:text-muted-foreground',
    IN_PROGRESS: 'ui:bg-primary/10 ui:text-primary',
    COMPLETED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  };

  function statusLabel(status: LearningProgressStatus) {
    return $t(`celluloplast_progress.status.${status}`);
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString();
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{$t('celluloplast_progress.table.heading')}</Card.Title>
    <Card.Description>
      {$t('celluloplast_progress.table.subtitle', { count: rows.length })}
    </Card.Description>
  </Card.Header>
  <Card.Content>
    {#if rows.length === 0}
      <Empty icon={ChartColumnIcon} title={$t('celluloplast_progress.table.empty')} />
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{$t('celluloplast_progress.table.employee')}</Table.Head>
            <Table.Head>{$t('celluloplast_progress.table.training')}</Table.Head>
            <Table.Head>{$t('celluloplast_progress.table.progress')}</Table.Head>
            <Table.Head>{$t('celluloplast_progress.table.lessons_done')}</Table.Head>
            <Table.Head>{$t('celluloplast_progress.table.lessons_total')}</Table.Head>
            <Table.Head>{$t('celluloplast_progress.table.status')}</Table.Head>
            <Table.Head>{$t('celluloplast_progress.table.last_activity')}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.groupMemberId + ':' + row.courseId)}
            <Table.Row>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <UserAvatar src={row.avatarUrl} alt={row.fullname ?? row.email ?? 'Learner'} class="h-7 w-7" />
                  <div class="min-w-0">
                    <p class="ui:text-foreground truncate text-sm font-medium">{row.fullname ?? '—'}</p>
                    <p class="ui:text-muted-foreground truncate text-xs">{row.email ?? ''}</p>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell class="text-sm">{row.courseTitle}</Table.Cell>
              <Table.Cell class="text-sm font-medium">{row.progressPercent} %</Table.Cell>
              <Table.Cell class="text-sm">{row.lessonsCompleted}</Table.Cell>
              <Table.Cell class="text-sm">{row.lessonsTotal}</Table.Cell>
              <Table.Cell>
                <Badge variant="outline" class={statusTone[row.status]}>{statusLabel(row.status)}</Badge>
              </Table.Cell>
              <Table.Cell class="ui:text-muted-foreground text-sm">{formatDate(row.lastActivityAt)}</Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </Card.Content>
</Card.Root>
