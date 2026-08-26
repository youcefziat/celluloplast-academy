<script lang="ts">
  import { preventDefault } from '$lib/utils/functions/svelte';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { createCourseModal } from '../utils/store';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { InputField } from '@cio/ui/custom/input-field';
  import * as Dialog from '@cio/ui/base/dialog';
  import { Button } from '@cio/ui/base/button';
  import { t } from '$lib/utils/functions/translations';
  import { snackbar } from '$features/ui/snackbar/store';
  import { courseApi } from '../api';
  import { CELLULOPLAST_AUTHORING, isCelluloplastAiUiEnabled } from '$lib/celluloplast/course-authoring';

  function onClose(redirectTo: string) {
    goto(redirectTo);

    createCourseModal.update(() => ({
      title: '',
      description: '',
      type: '',
      emails: '',
      tutors: '',
      students: ''
    }));
  }

  async function createCourse() {
    await courseApi.create(
      {
        title: $createCourseModal.title,
        description: $createCourseModal.description,
        type: CELLULOPLAST_AUTHORING.defaultCourseType
      },
      async (courseId) => {
        await courseApi.update(
          courseId,
          {
            certificate: {
              isDownloadable: CELLULOPLAST_AUTHORING.defaultCertificate.isDownloadable,
              threshold: CELLULOPLAST_AUTHORING.defaultCertificate.threshold
            }
          },
          { showSuccessToast: false }
        );

        snackbar.success('celluloplast_authoring.created');
        onClose(CELLULOPLAST_AUTHORING.afterCreatePath(courseId));
      }
    );
  }

  let open = $derived(new URLSearchParams(page.url.search).get('create') === 'true');
</script>

<Dialog.Root
  bind:open
  onOpenChange={(isOpen) => {
    if (!isOpen) onClose(page.url.pathname);
  }}
>
  <Dialog.Content class="mx-auto w-4/5 max-w-lg md:w-2/5">
    <Dialog.Header>
      <Dialog.Title>{$t('celluloplast_authoring.new_training_title')}</Dialog.Title>
      <Dialog.Description>{$t('celluloplast_authoring.new_training_subtitle')}</Dialog.Description>
    </Dialog.Header>

    <form onsubmit={preventDefault(createCourse)} class="space-y-4">
      <InputField
        label={$t('celluloplast_authoring.name_label')}
        bind:value={$createCourseModal.title}
        placeholder={$t('celluloplast_authoring.name_placeholder')}
        className="w-full"
        isRequired={true}
        errorMessage={courseApi.errors.title}
        autoComplete={false}
      />

      <TextareaField
        label={$t('celluloplast_authoring.description_label')}
        bind:value={$createCourseModal.description}
        rows={4}
        placeholder={$t('celluloplast_authoring.description_placeholder')}
        className="mb-2"
        isRequired={true}
        errorMessage={courseApi.errors.description}
        isAIEnabled={isCelluloplastAiUiEnabled()}
      />

      <Dialog.Footer>
        <Button type="submit" disabled={courseApi.isLoading} loading={courseApi.isLoading}>
          {$t('celluloplast_authoring.create_button')}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
