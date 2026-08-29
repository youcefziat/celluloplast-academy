<script lang="ts">
  import {
    CERTIFICATE_FONTS_STYLESHEET_URL,
    CERTIFICATE_PREVIEW_CONTEXT,
    CERTIFICATE_TEMPLATES,
    type CertificateTemplateId,
    type CertificateVariableContext
  } from '@cio/certificates';
  import { Certificate } from '@cio/ui';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import * as Dialog from '@cio/ui/base/dialog';
  import { IconButton } from '@cio/ui/custom/icon-button';
  import BracesIcon from '@lucide/svelte/icons/braces';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { appInitApi } from '$features/app/init.svelte';
  import { UnsavedChanges } from '$features/ui';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg, currentOrgPath, isOrgAdmin, isOrgTeamMember } from '$lib/utils/store/org';
  import { certificateDesignerStore as store } from '../stores/certificate-designer.svelte';
  import type { CertificateDesignerPanel } from '../utils/types';
  import AddElementsPanel from './add-elements-panel.svelte';
  import CertificateCanvas from './certificate-canvas.svelte';
  import ElementToolbar from './element-toolbar.svelte';
  import LayersPanel from './layers-panel.svelte';
  import PropertiesPanel from './properties-panel.svelte';
  import TemplatesPanel from './templates-panel.svelte';

  let templateToApply = $state<CertificateTemplateId | null>(null);
  let resetDialogOpen = $state(false);

  $effect(() => {
    const orgId = $currentOrg.id;
    if (!$isOrgTeamMember || !orgId) return;

    store.syncFromOrg(orgId);
  });

  $effect(() => {
    if (!appInitApi.isInitializedAndReady || $isOrgTeamMember !== false) return;

    void goto(resolve('/lms'), { replaceState: true });
  });

  const previewContext = $derived.by(
    (): CertificateVariableContext => ({
      ...CERTIFICATE_PREVIEW_CONTEXT,
      organization: {
        name: $currentOrg.name || CERTIFICATE_PREVIEW_CONTEXT.organization.name,
        logoUrl: $currentOrg.avatarUrl || undefined
      }
    })
  );
  const previewRenderData = $derived({
    recipientName: previewContext.student.fullName,
    recipientFirstName: previewContext.student.firstName,
    recipientLastName: previewContext.student.lastName,
    recipientEmail: previewContext.student.email,
    courseName: previewContext.course.name,
    courseDescription: previewContext.course.description,
    orgName: previewContext.organization.name,
    orgLogoUrl: previewContext.organization.logoUrl,
    date: previewContext.certificate.date,
    certificateId: previewContext.certificate.id
  });
  const backHref = $derived(`${$currentOrgPath}/settings`);
  const activeTemplateLabel = $derived(
    CERTIFICATE_TEMPLATES.find((template) => template.id === store.layout.sourcePresetId)?.label ??
      $t('certificate_designer.custom_design')
  );

  function panelClass(panel: CertificateDesignerPanel) {
    return store.activePanel === panel ? 'ui:ring-primary ring-2' : 'opacity-60';
  }

  function requestTemplate(templateId: CertificateTemplateId) {
    if (store.isDirty) {
      templateToApply = templateId;
      return;
    }

    store.applyTemplate(templateId);
  }

  function confirmTemplate() {
    if (templateToApply) store.applyTemplate(templateToApply);
    templateToApply = null;
  }

  function confirmReset() {
    store.resetToDefault();
    resetDialogOpen = false;
  }

  onMount(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      if (!$isOrgAdmin || store.mode !== 'edit') return;

      const commandKey = event.ctrlKey || event.metaKey;
      if (commandKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      } else if (commandKey && event.key.toLowerCase() === 'c') {
        store.copySelected();
      } else if (commandKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        store.pasteCopied();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        store.deleteSelected();
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link rel="stylesheet" href={CERTIFICATE_FONTS_STYLESHEET_URL} />
</svelte:head>

<UnsavedChanges hasUnsavedChanges={store.isDirty} skipPrompt={!$isOrgAdmin} />

{#if $isOrgTeamMember === true}
  <div class="ui:bg-background ui:text-foreground -mx-4 flex min-h-[calc(100dvh-4rem)] w-[calc(100%+2rem)] flex-col">
    <div class="lg:hidden">
      <div class="ui:border-border ui:bg-card m-4 rounded-lg border p-5 text-center text-sm">
        {$t('certificate_designer.desktop_only')}
      </div>
    </div>

    <div class="hidden min-h-0 flex-1 flex-col lg:flex">
      <header class="ui:border-border flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div class="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="sm" href={backHref}>{$t('certificate_designer.back')}</Button>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="truncate text-base font-semibold">{$t('certificate_designer.title')}</h1>
              <Badge variant="secondary">{activeTemplateLabel}</Badge>
              {#if store.isDirty}
                <Badge variant="outline">{$t('certificate_designer.unsaved')}</Badge>
              {/if}
            </div>
            <p class="ui:text-muted-foreground text-xs">{$t('certificate_designer.subtitle')}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          {#if $isOrgAdmin}
            <Button
              variant={store.mode === 'preview' ? 'secondary' : 'outline'}
              size="sm"
              onclick={() => (store.mode = store.mode === 'edit' ? 'preview' : 'edit')}
            >
              {#if store.mode === 'edit'}<EyeIcon class="size-4" />{:else}<PencilIcon class="size-4" />{/if}
              {store.mode === 'edit' ? $t('certificate_designer.preview') : $t('certificate_designer.edit')}
            </Button>
            <Button variant="outline" size="sm" onclick={() => (resetDialogOpen = true)}>
              {$t('certificate_designer.reset')}
            </Button>
            <Button variant="outline" size="sm" disabled={!store.isDirty} onclick={() => store.discard()}>
              {$t('certificate_designer.discard')}
            </Button>
            <Button
              size="sm"
              loading={store.isSaving}
              disabled={!store.isDirty || store.isUploading}
              onclick={() => store.save()}
            >
              {$t('certificate_designer.save')}
            </Button>
          {:else}
            <Badge variant="outline">{$t('certificate_designer.read_only')}</Badge>
          {/if}
        </div>
      </header>

      {#if $isOrgAdmin && store.mode === 'edit'}
        <ElementToolbar />
      {/if}

      <div class="flex min-h-0 flex-1">
        {#if $isOrgAdmin && store.mode === 'edit'}
          <nav class="ui:border-border ui:bg-secondary flex w-16 shrink-0 flex-col items-center gap-2 border-r py-3">
            <IconButton
              variant="secondary"
              class={panelClass('add')}
              tooltip={$t('certificate_designer.add')}
              tooltipSide="right"
              aria-label={$t('certificate_designer.add')}
              onclick={() => (store.activePanel = 'add')}
            >
              <PlusIcon class="size-4" />
            </IconButton>
            <IconButton
              variant="secondary"
              class={panelClass('templates')}
              tooltip={$t('certificate_designer.templates')}
              tooltipSide="right"
              aria-label={$t('certificate_designer.templates')}
              onclick={() => (store.activePanel = 'templates')}
            >
              <LayoutTemplateIcon class="size-4" />
            </IconButton>
            <IconButton
              variant="secondary"
              class={panelClass('layers')}
              tooltip={$t('certificate_designer.layers')}
              tooltipSide="right"
              aria-label={$t('certificate_designer.layers')}
              onclick={() => (store.activePanel = 'layers')}
            >
              <LayersIcon class="size-4" />
            </IconButton>
            <IconButton
              variant="secondary"
              class={panelClass('properties')}
              tooltip={$t('certificate_designer.properties')}
              tooltipSide="right"
              aria-label={$t('certificate_designer.properties')}
              onclick={() => (store.activePanel = 'properties')}
            >
              <BracesIcon class="size-4" />
            </IconButton>
          </nav>

          <aside class="ui:border-border ui:bg-card flex w-[330px] shrink-0 flex-col border-r">
            <div class="ui:border-border border-b px-5 py-4">
              <h2 class="text-sm font-semibold">{$t(`certificate_designer.panel_${store.activePanel}`)}</h2>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {#if store.activePanel === 'add'}
                <AddElementsPanel />
              {:else if store.activePanel === 'templates'}
                <TemplatesPanel onRequestTemplate={requestTemplate} />
              {:else if store.activePanel === 'layers'}
                <LayersPanel />
              {:else}
                <PropertiesPanel />
              {/if}
            </div>
          </aside>
        {/if}

        <section
          class="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-100 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] [background-size:18px_18px] dark:bg-slate-950"
          aria-label={$t('certificate_designer.canvas')}
        >
          {#if store.mode === 'preview' || !$isOrgAdmin}
            <Certificate.Preview design={store.layout} data={previewRenderData} showControls />
          {:else}
            <CertificateCanvas context={previewContext} />
          {/if}
        </section>
      </div>
    </div>
  </div>
{/if}

<Dialog.Root open={templateToApply !== null} onOpenChange={(open) => !open && (templateToApply = null)}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('certificate_designer.template_confirm_title')}</Dialog.Title>
      <Dialog.Description>{$t('certificate_designer.template_confirm_description')}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (templateToApply = null)}>{$t('common.cancel')}</Button>
      <Button onclick={confirmTemplate}>{$t('certificate_designer.apply_template')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root open={resetDialogOpen} onOpenChange={(open) => (resetDialogOpen = open)}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('certificate_designer.reset_confirm_title')}</Dialog.Title>
      <Dialog.Description>{$t('certificate_designer.reset_confirm_description')}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (resetDialogOpen = false)}>{$t('common.cancel')}</Button>
      <Button variant="destructive" onclick={confirmReset}>{$t('certificate_designer.reset')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
