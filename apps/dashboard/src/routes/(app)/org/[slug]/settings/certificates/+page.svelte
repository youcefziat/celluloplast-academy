<script lang="ts">
  import OrgCertificatesPage from '$features/org/pages/certificates.svelte';
  import { t } from '$lib/utils/functions/translations';
</script>

<svelte:head>
  <title>{$t('certificate_designer.page_title')}</title>
</svelte:head>

<OrgCertificatesPage />
