import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';

type SettingsHeaderAction = {
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick: null | (() => void | Promise<void>);
};

export const settingsHeaderAction: Writable<SettingsHeaderAction> = writable({
  label: 'Save',
  disabled: true,
  loading: false,
  onClick: null
});
