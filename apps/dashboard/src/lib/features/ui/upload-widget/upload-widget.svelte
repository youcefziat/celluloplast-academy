<script lang="ts">
  import { snackbar } from '$features/ui/snackbar/store';
  import * as Dialog from '@cio/ui/base/dialog';
  import { handleOpenWidget } from '$features/ui/upload-widget/store';

  import { t } from '$lib/utils/functions/translations';
  import { uploadImage } from '$lib/utils/services/upload';
  import * as ImageCropper from '@cio/ui/custom/image-cropper';
  import UploadCloudIcon from '@lucide/svelte/icons/upload-cloud';
  import { getResolvedUploadLimits } from '$lib/utils/config/upload-limits-context';

  interface Props {
    imageURL?: string;
    onchange?: (_v: string) => void;
  }

  let { imageURL = $bindable(''), onchange }: Props = $props();

  // Course cover preview is rendered in a 280×200 frame, so crop uploads to
  // that ratio instead of storing the raw image and letting CSS squeeze it.
  const COVER_ASPECT = 280 / 200;

  let isUploading = $state(false);
  let cropperSrc = $state('');

  const uploadLimits = getResolvedUploadLimits();
  const maxLandingImageSize = uploadLimits.landingImageBytes;

  function handleUnsupportedFile(file: File) {
    if (file.size > maxLandingImageSize) {
      snackbar.error('snackbar.landing_page_settings.error.file_size');
      return;
    }

    snackbar.error('snackbar.landing_page_settings.error.file_size');
  }

  const handleCropped = async (croppedUrl: string) => {
    const response = await fetch(croppedUrl);
    const blob = await response.blob();
    const file = new File([blob], 'course-cover.png', { type: blob.type });

    await handleUploadImage(file);
  };

  const handleUploadImage = async (image: File) => {
    isUploading = true;
    if (!image) {
      return;
    }

    imageURL = await uploadImage(image);

    onchange?.(imageURL);
    isUploading = false;

    snackbar.success(`snackbar.landing_page_settings.success.complete`);
    $handleOpenWidget.open = false;
  };
</script>

<Dialog.Root
  bind:open={$handleOpenWidget.open}
  onOpenChange={(isOpen) => {
    if (!isOpen) $handleOpenWidget.open = false;
  }}
>
  <Dialog.Content class="ui:z-300! w-[95%] max-w-2xl!">
    <Dialog.Header>
      <Dialog.Title>{$t('course.navItem.landing_page.upload_widget.title')}</Dialog.Title>
    </Dialog.Header>
    <div class="w-full bg-white p-2 dark:bg-inherit">
      <div class="w-full {isUploading ? 'ui:opacity-50 ui:pointer-events-none' : ''}">
        <ImageCropper.Root
          bind:src={cropperSrc}
          onCropped={handleCropped}
          onUnsupportedFile={handleUnsupportedFile}
          maxFileSize={maxLandingImageSize}
          accept=".jpg, .jpeg, .png, .webp"
          disabled={isUploading}
        >
          <ImageCropper.UploadTrigger
            class="ui:flex ui:w-full ui:flex-col ui:items-center ui:justify-center ui:gap-2 ui:rounded-lg ui:border-2 ui:border-dashed ui:border-input ui:bg-muted/30 ui:px-6 ui:py-10 ui:text-center ui:transition-colors ui:hover:bg-muted/60"
          >
            <UploadCloudIcon class="ui:text-muted-foreground" size={28} />
            <p class="ui:m-0 ui:text-sm ui:font-medium">
              {$t('course.navItem.landing_page.upload_widget.drag_drop')}
            </p>
            <p class="ui:m-0 ui:text-xs ui:text-muted-foreground">
              {$t('course.navItem.landing_page.upload_widget.size')}
            </p>
          </ImageCropper.UploadTrigger>

          <ImageCropper.Dialog class="ui:z-[400]!">
            <ImageCropper.Cropper cropShape="rect" aspect={COVER_ASPECT} />
            <ImageCropper.Controls>
              <ImageCropper.Cancel />
              <ImageCropper.Crop />
            </ImageCropper.Controls>
          </ImageCropper.Dialog>
        </ImageCropper.Root>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
