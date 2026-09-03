<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import * as Dialog from '@cio/ui/base/dialog';
  import { t } from '$lib/utils/functions/translations';
  import { viewAsStudent } from '$features/course/utils/course-preview';

  interface Props {
    open?: boolean;
    courseId?: string | null;
    currentOrgDomain?: string;
  }

  let { open = $bindable(false), courseId = null, currentOrgDomain = '' }: Props = $props();

  let isNavigating = $state(false);

  async function handleGoToLms() {
    isNavigating = true;

    // Opens the student view in a new tab; close the modal once the handoff starts.
    const ok = await viewAsStudent({ courseId, currentOrgDomain });
    isNavigating = false;

    if (ok) {
      open = false;
    }
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(isOpen) => {
    if (!isOpen && !isNavigating) open = false;
  }}
>
  <Dialog.Content class="w-[calc(100%-2rem)] max-w-xl! p-4">
    <Dialog.Header>
      <Dialog.Title>{$t('course.view_as_student.title')}</Dialog.Title>
      <Dialog.Description>{$t('course.view_as_student.description')}</Dialog.Description>
    </Dialog.Header>

    <Dialog.Footer>
      <Button variant="default" onclick={handleGoToLms} disabled={!courseId} loading={isNavigating}>
        {$t('course.view_as_student.go_to_lms')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
