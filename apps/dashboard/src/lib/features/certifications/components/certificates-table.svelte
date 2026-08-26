<script lang="ts">
  import * as Card from '@cio/ui/base/card';
  import * as Table from '@cio/ui/base/table';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import { UserAvatar } from '@cio/ui/custom/user-avatar';
  import AwardIcon from '@lucide/svelte/icons/award';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import { t } from '$lib/utils/functions/translations';
  import { snackbar } from '$features/ui/snackbar/store';
  import type { LearningOverviewLearner } from '$features/learning-overview';
  import { downloadLearnerCertificatePdf } from '../utils/download-certificate';

  interface Props {
    rows: LearningOverviewLearner[];
  }

  let { rows }: Props = $props();

  let downloadingKey = $state<string | null>(null);

  function formatDate(iso: string | null) {
    if (!iso) return '—';

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString();
  }

  async function handleDownload(row: LearningOverviewLearner) {
    if (!row.certificateEarnedAt) return;

    const key = `${row.profileId}:${row.courseId}`;
    downloadingKey = key;

    try {
      await downloadLearnerCertificatePdf({
        courseId: row.courseId,
        courseTitle: row.courseTitle,
        profileId: row.profileId,
        fullname: row.fullname,
        certificateEarnedAt: row.certificateEarnedAt
      });
    } catch (error) {
      console.error('Certificate download failed:', error);
      snackbar.error('celluloplast_certifications.download_error');
    }

    downloadingKey = null;
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{$t('celluloplast_certifications.table.heading')}</Card.Title>
    <Card.Description>
      {$t('celluloplast_certifications.table.subtitle', { count: rows.length })}
    </Card.Description>
  </Card.Header>
  <Card.Content>
    {#if rows.length === 0}
      <Empty icon={AwardIcon} title={$t('celluloplast_certifications.empty')} />
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{$t('celluloplast_certifications.table.employee')}</Table.Head>
            <Table.Head>{$t('celluloplast_certifications.table.training')}</Table.Head>
            <Table.Head>{$t('celluloplast_certifications.table.earned_at')}</Table.Head>
            <Table.Head class="text-right">{$t('celluloplast_certifications.table.action')}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.groupMemberId + ':' + row.courseId)}
            {@const rowKey = `${row.profileId}:${row.courseId}`}
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
              <Table.Cell class="ui:text-muted-foreground text-sm">{formatDate(row.certificateEarnedAt)}</Table.Cell>
              <Table.Cell class="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!row.certificateEarnedAt || downloadingKey === rowKey}
                  loading={downloadingKey === rowKey}
                  onclick={() => handleDownload(row)}
                >
                  <DownloadIcon class="size-4" />
                  {$t('celluloplast_certifications.table.view')}
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </Card.Content>
</Card.Root>
