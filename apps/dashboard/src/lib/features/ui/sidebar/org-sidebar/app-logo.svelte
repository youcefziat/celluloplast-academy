<script lang="ts">
  import * as Avatar from '@cio/ui/base/avatar';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import { APP_DISPLAY_NAME, DEFAULT_LOGO_PATH } from '$lib/celluloplast/brand';
  import { resolve } from '$app/paths';
</script>

<Sidebar.Menu>
  <Sidebar.MenuItem>
    <Sidebar.MenuButton
      size="sm"
      class="ui:data-[state=open]:bg-sidebar-accent ui:data-[state=open]:text-sidebar-accent-foreground"
    >
      {#snippet child({ props })}
        <a href={resolve('/')} {...props}>
          <Avatar.Root class="ui:flex ui:size-6 ui:items-center ui:justify-center">
            <Avatar.Image src={DEFAULT_LOGO_PATH} alt={APP_DISPLAY_NAME} />
          </Avatar.Root>

          <!-- Celluloplast V1 hides paid plans: no plan badge next to the product name. -->
          <span class="truncate font-normal">{APP_DISPLAY_NAME}</span>
        </a>
      {/snippet}
    </Sidebar.MenuButton>
  </Sidebar.MenuItem>
</Sidebar.Menu>
