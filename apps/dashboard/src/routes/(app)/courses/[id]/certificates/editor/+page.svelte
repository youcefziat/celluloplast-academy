<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentOrgPath } from '$lib/utils/store/org';

  $effect(() => {
    void goto(`${$currentOrgPath}/settings/certificates`, { replaceState: true });
  });
</script>
