<script lang="ts">
  import * as Select from '@cio/ui/base/select';
  import { QUESTION_TYPES } from '$features/ui/question/constants';
  import { getExerciseEditorQuestionTypeLabel } from './question-type-utils';
  import { t } from '$lib/utils/functions/translations';
  import type { Question } from '$features/course/types';

  type QuestionTypeEntry = (typeof QUESTION_TYPES)[number];

  interface Props {
    value: string | undefined;
    onValueChange: (value: string) => void;
    triggerQuestionType: Question['questionType'] | undefined;
    types: QuestionTypeEntry[];
  }

  let { value, onValueChange, triggerQuestionType, types }: Props = $props();

  let isSelectOpen = $state(false);

  const autoGradableTypes = $derived(types.filter((typeEntry) => typeEntry.autoGradable));
  const manuallyGradedTypes = $derived(types.filter((typeEntry) => !typeEntry.autoGradable));
</script>

{#snippet sectionTitle({ title, description })}
  <div>
    <Select.Label>
      <p class="font-semibold">
        {$t(title)}
      </p>
      <p class="ui:text-muted-foreground ui:mt-1 ui:text-xs">
        {$t(description)}
      </p>
    </Select.Label>
  </div>
{/snippet}

<Select.Root type="single" {value} {onValueChange} bind:open={isSelectOpen}>
  <Select.Trigger class="w-full min-w-0 sm:w-[180px]">
    {getExerciseEditorQuestionTypeLabel(triggerQuestionType)}
  </Select.Trigger>
  <Select.Content class="max-h-[300px]!">
    <Select.Group>
      {@render sectionTitle({
        title: 'course.navItem.lessons.exercises.all_exercises.edit_mode.question_type_auto_gradable',
        description: 'course.navItem.lessons.exercises.all_exercises.edit_mode.question_type_auto_gradable_description'
      })}

      {#each autoGradableTypes as typeEntry (typeEntry.key)}
        <Select.Item value={typeEntry.id.toString()} label={getExerciseEditorQuestionTypeLabel(typeEntry)}>
          {getExerciseEditorQuestionTypeLabel(typeEntry)}
        </Select.Item>
      {/each}
    </Select.Group>

    {#if manuallyGradedTypes.length > 0}
      <Select.Separator />

      <Select.Group>
        {@render sectionTitle({
          title: 'course.navItem.lessons.exercises.all_exercises.edit_mode.question_type_manual_grading',
          description:
            'course.navItem.lessons.exercises.all_exercises.edit_mode.question_type_manual_grading_description'
        })}

        {#each manuallyGradedTypes as typeEntry (typeEntry.key)}
          <Select.Item value={typeEntry.id.toString()} label={getExerciseEditorQuestionTypeLabel(typeEntry)}>
            {getExerciseEditorQuestionTypeLabel(typeEntry)}
          </Select.Item>
        {/each}
      </Select.Group>
    {/if}
  </Select.Content>
</Select.Root>
