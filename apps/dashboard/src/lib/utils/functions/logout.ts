import { appInitApi } from '$features/app/init.svelte';
import { authClient } from '$lib/utils/services/auth/client';
import { clearSentryUser } from '$lib/utils/services/sentry';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export async function logout(redirect = true) {
  const { error } = await authClient.signOut();

  if (error) {
    console.error('Error logging out: ', error);
  }

  appInitApi.reset();

  clearSentryUser();

  if (redirect) {
    goto(resolve('/login', {}));
  }
}
