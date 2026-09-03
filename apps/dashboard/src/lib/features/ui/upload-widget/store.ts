import { writable } from 'svelte/store';

/** Open state of the shared image upload dialog. */
export const handleOpenWidget = writable({
  open: false
});
