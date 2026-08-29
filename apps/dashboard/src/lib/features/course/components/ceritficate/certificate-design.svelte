<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { Certificate } from '@cio/ui';
  import * as Card from '@cio/ui/base/card';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import { t } from '$lib/utils/functions/translations';

  import { courseApi } from '$features/course/api';
  import { resolveOrgCertificateDesign } from '$features/org/utils/certificate-design';
  import { currentOrg, currentOrgPath, isFreePlan } from '$lib/utils/store/org';
  import type { CertificateLayout } from '@cio/certificates';

  type Props = {
    errors?: Record<string, string>;
  };

  let { errors: _errors }: Props = $props();

  const design: CertificateLayout = $derived(resolveOrgCertificateDesign($currentOrg.settings));

  const previewData = $derived({
    recipientName: 'Eleanor Vance',
    courseName: courseApi.course?.title ?? 'Course Title',
    courseDescription: courseApi.course?.description || '',
    orgName: $currentOrg.name || 'Organization',
    orgLogoUrl: $currentOrg.avatarUrl || undefined,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }),
    certificateId: (design.certificateIdFormat ?? 'N° {seq}').replace('{seq}', '0247')
  });

  const editorHref = $derived(`${$currentOrgPath}/settings/certificates`);
</script>

<div class="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
  <div class="aspect-[1.4/1] w-full">
    <Certificate.Preview {design} data={previewData} zoom="fit" />
  </div>

  <div class="flex flex-col gap-3">
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-base">{$t('celluloplast_org_certificates.editor_title')}</Card.Title>
        <Card.Description>{$t('celluloplast_org_certificates.course_summary_subtitle')}</Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button variant="secondary" class="w-full justify-center" disabled={$isFreePlan} href={editorHref}>
          {$t('celluloplast_org_certificates.edit_enterprise_design')}
          <ArrowRightIcon class="size-4" />
        </Button>
      </Card.Footer>
    </Card.Root>
  </div>
</div>
