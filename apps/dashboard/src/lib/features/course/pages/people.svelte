<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Button } from '@cio/ui/base/button';
  import * as Table from '@cio/ui/base/table';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import CheckIcon from '@lucide/svelte/icons/check';

  import { Chip } from '@cio/ui/custom/chip';
  import * as Avatar from '@cio/ui/base/avatar';
  import { ComingSoon, RoleBasedSecurity } from '$features/ui';
  import InvitationModal from '$features/course/components/people/invitation-modal.svelte';
  import GrantAccessModal from '$features/course/components/people/grant-access-modal.svelte';
  import DeleteConfirmation from '$features/course/components/people/delete-confirmation.svelte';
  import { isStudentLimitReached } from '$lib/utils/store/org';

  import { profile } from '$lib/utils/store/user';
  import type { CourseMembers, CourseMember } from '$features/course/utils/types';
  import { courseApi } from '$features/course/api';
  import { t } from '$lib/utils/functions/translations';
  import UserIcon from '@lucide/svelte/icons/user';
  import { shortenName } from '$lib/utils/functions/string';
  import * as Select from '@cio/ui/base/select';
  import { IconButton } from '@cio/ui/custom/icon-button';
  import { ROLE_LABEL, ROLES } from '$lib/utils/constants/roles';
  import { peopleApi } from '$features/course/api';
  import { deleteMemberModal } from '$features/course/components/people/store';
  import { Search } from '@cio/ui/custom/search';
  import { ROLE } from '@cio/utils/constants';
  import { CELLULOPLAST_PEOPLE, isCelluloplastPeopleSimplified } from '$lib/celluloplast/people';

  let member: { id?: string; email?: string; profile?: { email: string } } = $state({});
  let filterBy: string = $state(
    isCelluloplastPeopleSimplified() && CELLULOPLAST_PEOPLE.listStudentsOnly ? `${ROLE.STUDENT}` : `${ROLES[0].value}`
  );
  let searchValue = $state('');
  let copiedEmail = $state<string | null>(null);
  const isSimplified = isCelluloplastPeopleSimplified();

  const people: CourseMembers = $derived(sortAndFilterPeople(courseApi.group.people, filterBy));

  function filterPeople(_query: string, peopleList: CourseMembers) {
    const query = _query.toLowerCase();
    return peopleList.filter((person) => {
      const { profile: personProfile, email } = person;
      return personProfile?.fullname?.toLowerCase()?.includes(query) || email?.toLowerCase()?.includes(query);
    });
  }

  async function deletePerson() {
    if (!member.id || !courseApi.course?.id) return;

    await peopleApi.delete(courseApi.course?.id, member.id);

    if (peopleApi.success) {
      courseApi.group.people = courseApi.group.people.filter((person: { id: string }) => person.id !== member.id);
      courseApi.group.tutors = courseApi.group.tutors.filter((person: CourseMember) => person.id !== member.id);
    }
  }

  function sortAndFilterPeople(_people: CourseMembers, roleFilter: string) {
    return (_people || [])
      .filter((person) => {
        if (isSimplified && CELLULOPLAST_PEOPLE.listStudentsOnly) {
          return Number(person.roleId) === ROLE.STUDENT;
        }

        if (roleFilter === 'all') return true;

        return person.roleId === Number(roleFilter);
      })
      .sort(
        (a: CourseMember, b: CourseMember) =>
          new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime()
      )
      .sort((a: CourseMember, b: CourseMember) => Number(a.roleId) - Number(b.roleId));
  }

  function getEmail(person: CourseMember) {
    const { profile: personProfile, email } = person;

    return personProfile ? personProfile.email : email;
  }

  function obscureEmail(email: string) {
    const [username, domain] = email.split('@');
    const obscuredUsername =
      username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);

    return `${obscuredUsername}@${domain}`;
  }

  function gotoPerson(person: CourseMember) {
    goto(`${page.url.href}/${person.profileId}`);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedEmail = text;
      setTimeout(() => {
        copiedEmail = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function formatAssignedAt(value: string | null | undefined) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  const selectOptions = $derived(ROLES.map((role) => ({ label: $t(role.label), value: `${role.value}` })));
  const searchPlaceholder = $derived(
    isSimplified ? $t('celluloplast_people.search_list_placeholder') : $t('course.navItem.people.search')
  );
</script>

<InvitationModal />
<GrantAccessModal />

{#if $isStudentLimitReached}{/if}

{#if !isSimplified || CELLULOPLAST_PEOPLE.showMemberRemoval}
  <DeleteConfirmation email={member.email || (member.profile && member.profile.email)} {deletePerson} />
{/if}

<section class="space-y-2">
  <div class="flex flex-col items-center justify-end gap-2 md:flex-row">
    <Search placeholder={searchPlaceholder} bind:value={searchValue} />
    {#if !isSimplified || CELLULOPLAST_PEOPLE.showRoleFilter}
      <Select.Root type="single" name="roles" bind:value={filterBy}>
        <Select.Trigger class="max-w-[80px]">
          {$t(ROLE_LABEL[Number(filterBy)])}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each selectOptions as option (option.value)}
              <Select.Item value={option.value} label={option.label} disabled={option.value === filterBy}>
                {option.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    {/if}
  </div>

  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#if isSimplified}
            <Table.Head>{$t('celluloplast_people.column_employee')}</Table.Head>
            <Table.Head>{$t('celluloplast_people.column_email')}</Table.Head>
            {#if CELLULOPLAST_PEOPLE.showAssignedAtColumn}
              <Table.Head>{$t('celluloplast_people.column_assigned_at')}</Table.Head>
            {/if}
            <Table.Head>{$t('celluloplast_people.column_action')}</Table.Head>
          {:else}
            <Table.Head>{$t('course.navItem.people.name')}</Table.Head>
            <Table.Head>{$t('course.navItem.people.role')}</Table.Head>
            <Table.Head>{$t('course.navItem.people.action')}</Table.Head>
          {/if}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each filterPeople(searchValue, people) as person (person.id)}
          <Table.Row>
            {#if isSimplified}
              <Table.Cell class="w-2/5">
                {#if person.profile}
                  <div class="flex items-center">
                    <Avatar.Root class="mr-3">
                      {#if person.profile.avatar_url}
                        <Avatar.Image
                          src={person.profile.avatar_url}
                          alt={person.profile.fullname ? person.profile.fullname : 'User'}
                        />
                      {/if}
                      <Avatar.Fallback>
                        <UserIcon class="ui:size-4 ui:text-muted-foreground" />
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <div>
                      <p class="text-base font-normal dark:text-white">
                        {person.profile.fullname}
                      </p>
                      {#if person.profileId == $profile.id}
                        <ComingSoon label={$t('course.navItem.people.you')} />
                      {/if}
                    </div>
                  </div>
                {:else}
                  <div class="flex items-center gap-2">
                    <Chip value={shortenName(person.email)} className="mr-1" />
                    <Chip value={$t('course.navItem.people.pending')} className="bg-yellow-200 text-yellow-700" />
                  </div>
                {/if}
              </Table.Cell>
              <Table.Cell class="w-1/4">
                <div class="flex items-center gap-1">
                  <p class="ui:text-muted-foreground text-sm">{getEmail(person)}</p>
                  <RoleBasedSecurity allowedRoles={[1, 2]}>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      onclick={() => copyToClipboard(getEmail(person))}
                    >
                      {#if copiedEmail === getEmail(person)}
                        <CheckIcon size={16} class="text-green-600" />
                      {:else}
                        <CopyIcon size={16} />
                      {/if}
                    </Button>
                  </RoleBasedSecurity>
                </div>
              </Table.Cell>
              {#if CELLULOPLAST_PEOPLE.showAssignedAtColumn}
                <Table.Cell class="w-1/5">
                  <p class="ui:text-muted-foreground text-sm">{formatAssignedAt(person.createdAt)}</p>
                </Table.Cell>
              {/if}
              <Table.Cell class="w-1/6">
                <RoleBasedSecurity allowedRoles={[1, 2]}>
                  <div class="hidden space-x-2 sm:flex sm:items-center">
                    {#if person.profileId !== $profile.id && person.profileId}
                      <Button variant="outline" onclick={() => gotoPerson(person)}>
                        {$t('course.navItem.people.view')}
                      </Button>
                    {/if}
                  </div>
                </RoleBasedSecurity>
              </Table.Cell>
            {:else}
              <Table.Cell class="w-4/6 md:w-3/6">
                {#if person.profile}
                  <div class="flex items-start lg:items-center">
                    <Avatar.Root class="mr-3">
                      {#if person.profile.avatar_url}
                        <Avatar.Image
                          src={person.profile.avatar_url}
                          alt={person.profile.fullname ? person.profile.fullname : 'User'}
                        />
                      {/if}
                      <Avatar.Fallback>
                        <UserIcon class="ui:size-4 ui:text-muted-foreground" />
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <div class="flex flex-col items-start lg:flex-row lg:items-center">
                      <div class="mr-2">
                        <p class="text-base font-normal dark:text-white">
                          {person.profile.fullname}
                        </p>
                        <p class="ui:text-primary line-clamp-1 text-xs">
                          {obscureEmail(getEmail(person))}
                        </p>
                      </div>
                      <div class="flex items-center">
                        <RoleBasedSecurity allowedRoles={[1, 2]}>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-8 w-8"
                            onclick={() => copyToClipboard(getEmail(person))}
                          >
                            {#if copiedEmail === getEmail(person)}
                              <CheckIcon size={16} class="text-green-600" />
                            {:else}
                              <CopyIcon size={16} />
                            {/if}
                          </Button>
                        </RoleBasedSecurity>
                        {#if person.profileId == $profile.id}
                          <ComingSoon label={$t('course.navItem.people.you')} />
                        {/if}
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class="flex w-2/4 items-start lg:items-center">
                    <Chip value={shortenName(person.email)} className="mr-3" />
                    <a href="mailto:{person.email}" class="text-md ui:text-primary mr-2 dark:text-white">
                      {person.email}
                    </a>
                    <div class="flex items-center justify-between">
                      <RoleBasedSecurity allowedRoles={[1, 2]}>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-8 w-8"
                          onclick={() => copyToClipboard(getEmail(person))}
                        >
                          {#if copiedEmail === getEmail(person)}
                            <CheckIcon size={16} class="text-green-600" />
                          {:else}
                            <CopyIcon size={16} />
                          {/if}
                        </Button>
                      </RoleBasedSecurity>

                      <Chip value={$t('course.navItem.people.pending')} className="bg-yellow-200 text-yellow-700" />
                    </div>
                  </div>
                {/if}
              </Table.Cell>

              <Table.Cell class="w-1/4">
                <p class=" w-1/4 text-center text-base font-normal dark:text-white">
                  {$t(ROLE_LABEL[Number(person.roleId)])}
                </p>
              </Table.Cell>

              <Table.Cell class="w-1/4">
                <RoleBasedSecurity allowedRoles={[1, 2]}>
                  <div class="hidden space-x-2 sm:flex sm:items-center">
                    {#if person.profileId !== $profile.id}
                      <IconButton
                        onclick={() => {
                          member = person;
                          $deleteMemberModal.open = true;
                        }}
                      >
                        <TrashIcon size={16} />
                      </IconButton>

                      <Button variant="outline" onclick={() => gotoPerson(person)}>
                        {$t('course.navItem.people.view')}
                      </Button>
                    {/if}
                  </div>
                </RoleBasedSecurity>
              </Table.Cell>
            {/if}
          </Table.Row>
        {:else}
          {#if isSimplified}
            <Table.Row>
              <Table.Cell colspan={4} class="ui:text-muted-foreground py-8 text-center text-sm">
                {$t('celluloplast_people.empty_list')}
              </Table.Cell>
            </Table.Row>
          {/if}
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
</section>
