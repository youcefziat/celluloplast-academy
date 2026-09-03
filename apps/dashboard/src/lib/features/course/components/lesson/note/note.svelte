<script lang="ts">
  import { HTMLRender, TextEditor } from '$features/ui';
  import { SafeHtmlContent } from '@cio/ui/custom/safe-html-content';
  import { isHtmlValueEmpty } from '$lib/utils/functions/toHtml';
  import { lessonApi } from '$features/course/api';
  import { t } from '$lib/utils/functions/translations';
  import MODES from '$lib/utils/constants/mode';
  import type { Content } from '@cio/ui/custom/editor';
  import type { TLocale } from '@cio/db/types';
  import { saveDraft } from '$features/course/utils/lesson-draft';

  interface Props {
    mode?: (typeof MODES)[keyof typeof MODES];
    lessonId?: string;
  }

  let { mode = MODES.view, lessonId = '' }: Props = $props();

  let hasAtLeastOneTranslation = $derived(
    Object.values(lessonApi.translations[lessonId] || {}).some((content) => {
      return content && !!content.length;
    })
  );

  function onEditorChange(content: Content) {
    if (mode === MODES.view) return;

    if (!lessonApi.translations[lessonId]) {
      lessonApi.translations[lessonId] = {} as Record<TLocale, string>;
    }
    lessonApi.translations[lessonId][lessonApi.currentLocale] = `${content}`;

    saveDraft(lessonId, lessonApi.currentLocale, `${content}`);
    lessonApi.isDirty = true;
  }

  const content = $derived(lessonApi.translations[lessonId]?.[lessonApi.currentLocale] || '');
</script>

{#if mode === MODES.edit}
  <div class="mt-5 h-[60vh]">
    <TextEditor
      {content}
      onChange={(content) => onEditorChange(content)}
      placeholder={$t('course.navItem.lessons.materials.tabs.note.placeholder')}
    />
  </div>
{:else}
  <!-- View Mode -->
  {#if !isHtmlValueEmpty(content)}
    <div class="relative mx-auto w-full max-w-2xl">
      <HTMLRender>
        <SafeHtmlContent {content} />
      </HTMLRender>
    </div>
  {:else if hasAtLeastOneTranslation}
    <p class="text-md py-2 font-normal italic dark:text-white">
      {$t('course.navItem.lessons.materials.no_translation')}
    </p>
  {/if}
{/if}
