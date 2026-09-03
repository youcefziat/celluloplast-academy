<script lang="ts">
  import * as DropdownMenu from '@cio/ui/base/dropdown-menu';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
  import { IconButton } from '@cio/ui/custom/icon-button';
  import CourseContextMenuContent from './course-context-menu-content.svelte';

  interface Props {
    id: string;
    title: string;
    description: string;
    isPublished?: boolean;
  }

  let { id, title, description, isPublished = false }: Props = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    class="ui:data-[state=open]:opacity-100 absolute top-6 right-6 z-40 flex items-center justify-center opacity-0 transition-all delay-150 duration-200 ease-in-out group-hover:opacity-100"
    onclick={(e) => e.stopPropagation()}
  >
    <IconButton variant="outline">
      <EllipsisVerticalIcon size={16} />
    </IconButton>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <CourseContextMenuContent {id} {title} {description} {isPublished} />
  </DropdownMenu.Content>
</DropdownMenu.Root>
