<script lang="ts">
  import { IconButton } from '@cio/ui/custom/icon-button';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
  import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
  import MaximizeIcon from '@lucide/svelte/icons/maximize';
  import { onMount } from 'svelte';
  import { t } from '$lib/utils/functions/translations';

  interface Props {
    /** Presigned URL of the PDF rendered from the uploaded deck. */
    link: string;
    name?: string;
  }

  let { link, name = '' }: Props = $props();

  let containerElement: HTMLDivElement | undefined = $state();
  let pdfCanvas: HTMLCanvasElement | undefined = $state();
  let pageNum = $state(1);
  let pageCount = $state(0);
  let scale = $state(1.0);
  let isLoading = $state(true);
  let error: string | null = $state(null);

  let pdfjsLib: any = null;
  let pdfDoc: any = null;
  let currentRenderTask: any = null;
  let renderTimeout: ReturnType<typeof setTimeout> | null = null;
  let loadedLink: string | null = null;

  function loadPdfJs(): Promise<any> {
    if ((window as any).pdfjsLib) {
      return Promise.resolve((window as any).pdfjsLib);
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-pdfjs]');
      const script = existing ?? document.createElement('script');

      script.addEventListener('load', () => resolve((window as any).pdfjsLib), { once: true });
      script.addEventListener('error', () => reject(new Error('Failed to load PDF.js')), { once: true });

      if (!existing) {
        script.src = '/js/pdf.js/pdf.min.js';
        script.dataset.pdfjs = 'true';
        document.head.appendChild(script);
      }
    });
  }

  async function renderPage() {
    if (!pdfDoc || !pdfCanvas) return;

    try {
      if (currentRenderTask) {
        currentRenderTask.cancel();
        currentRenderTask = null;
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;

      currentRenderTask = page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport });
      await currentRenderTask.promise;
      currentRenderTask = null;
    } catch (renderError) {
      // A cancelled render is expected while paging or zooming quickly.
      if ((renderError as { name?: string })?.name === 'RenderingCancelledException') return;

      console.error('Error rendering slide page:', renderError);
      error = 'course.navItem.lessons.materials.tabs.document.failed_to_render_pdf';
    }
  }

  function scheduleRender() {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => void renderPage(), 60);
  }

  async function loadDeck(source: string) {
    isLoading = true;
    error = null;

    try {
      pdfjsLib = pdfjsLib ?? (await loadPdfJs());
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.js/pdf.worker.min.js';

      const response = await fetch(source);
      if (!response.ok) {
        throw new Error('Failed to fetch slide PDF');
      }

      const arrayBuffer = await response.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pageCount = pdfDoc.numPages;
      pageNum = 1;
      isLoading = false;

      await renderPage();
    } catch (loadError) {
      console.error('Error loading slide PDF:', loadError);
      error = 'course.navItem.lessons.materials.tabs.document.failed_to_load_pdf';
      isLoading = false;
    }
  }

  $effect(() => {
    if (!link || link === loadedLink) return;

    loadedLink = link;
    void loadDeck(link);
  });

  onMount(() => {
    return () => {
      if (renderTimeout) clearTimeout(renderTimeout);
      if (currentRenderTask) currentRenderTask.cancel();
    };
  });

  function previousPage() {
    if (pageNum <= 1) return;

    pageNum -= 1;
    scheduleRender();
  }

  function nextPage() {
    if (pageNum >= pageCount) return;

    pageNum += 1;
    scheduleRender();
  }

  function zoomIn() {
    scale = Math.min(scale + 0.25, 3.0);
    scheduleRender();
  }

  function zoomOut() {
    scale = Math.max(scale - 0.25, 0.5);
    scheduleRender();
  }

  function toggleFullscreen() {
    if (!containerElement) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void containerElement.requestFullscreen();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') previousPage();
    if (event.key === 'ArrowRight') nextPage();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={containerElement}
  class="my-3 flex flex-col rounded-lg border bg-white dark:bg-neutral-900"
  role="region"
  aria-label={name}
  tabindex="-1"
  onkeydown={handleKeydown}
>
  <div class="flex items-center justify-between border-b px-3 py-2">
    <p class="ui:text-foreground max-w-md truncate text-sm font-medium">{name}</p>

    {#if !isLoading && !error}
      <div class="flex items-center gap-1">
        <IconButton onclick={previousPage} disabled={pageNum <= 1} tooltip="Previous page (←)">
          <ChevronLeftIcon size={16} />
        </IconButton>
        <span class="ui:text-muted-foreground min-w-20 text-center text-sm">
          {$t('course.navItem.lessons.materials.tabs.document.page_of', { page: pageNum, total: pageCount })}
        </span>
        <IconButton onclick={nextPage} disabled={pageNum >= pageCount} tooltip="Next page (→)">
          <ChevronRightIcon size={16} />
        </IconButton>

        <IconButton onclick={zoomOut} disabled={scale <= 0.5} tooltip="Zoom out">
          <ZoomOutIcon size={16} />
        </IconButton>
        <span class="ui:text-muted-foreground min-w-12 text-center text-sm">{Math.round(scale * 100)}%</span>
        <IconButton onclick={zoomIn} disabled={scale >= 3.0} tooltip="Zoom in">
          <ZoomInIcon size={16} />
        </IconButton>

        <IconButton onclick={toggleFullscreen} tooltip="Fullscreen">
          <MaximizeIcon size={16} />
        </IconButton>
      </div>
    {/if}
  </div>

  <div class="flex-1 overflow-auto bg-gray-100 p-4 dark:bg-neutral-800" style="min-height: 569px;">
    {#if isLoading}
      <div class="flex h-full items-center justify-center">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
          aria-label={$t('course.navItem.lessons.materials.tabs.document.loading_pdf')}
        ></div>
      </div>
    {:else if error}
      <p class="text-center text-sm text-red-600">{$t(error)}</p>
    {:else}
      <canvas bind:this={pdfCanvas} class="mx-auto max-w-full shadow-sm"></canvas>
    {/if}
  </div>
</div>
