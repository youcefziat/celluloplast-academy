<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import * as Card from '@cio/ui/base/card';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

  import { currentOrgPath } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';

  const editorHref = $derived(`${$currentOrgPath}/settings/certificates`);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{$t('celluloplast_org_certificates.editor_title')}</Card.Title>
    <Card.Description>{$t('celluloplast_org_certificates.course_summary_subtitle')}</Card.Description>
  </Card.Header>
  <Card.Footer>
    <Button variant="secondary" href={editorHref}>
      {$t('celluloplast_org_certificates.edit_enterprise_design')}
      <ArrowRightIcon class="size-4" />
    </Button>
  </Card.Footer>
</Card.Root>
