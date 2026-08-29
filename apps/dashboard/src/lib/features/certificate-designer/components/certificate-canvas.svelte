<script lang="ts">
  import {
    CERTIFICATE_PAGE_HEIGHT,
    CERTIFICATE_PAGE_WIDTH,
    resolveCertificateVariable,
    toCertificateLayoutElementSnapshot,
    type CertificateImageElement,
    type CertificateLayoutElement,
    type CertificateVariableContext
  } from '@cio/certificates';
  import { onMount } from 'svelte';

  import { certificateDesignerStore as store } from '../stores/certificate-designer.svelte';
  import type { CertificateResizeHandle } from '../utils/types';

  interface Props {
    context: CertificateVariableContext;
    readOnly?: boolean;
  }

  let { context, readOnly = false }: Props = $props();

  const FONT_STACKS = {
    inter: 'Inter, Arial, sans-serif',
    'cormorant-garamond': "'Cormorant Garamond', Georgia, serif",
    cinzel: 'Cinzel, Georgia, serif',
    'playfair-display': "'Playfair Display', Georgia, serif",
    'space-grotesk': "'Space Grotesk', Arial, sans-serif",
    'dm-mono': "'DM Mono', monospace"
  } as const;

  let viewport = $state<HTMLDivElement | null>(null);
  let scale = $state(0.65);
  let interaction = $state<{
    elementId: string;
    type: 'drag' | 'resize';
    handle?: CertificateResizeHandle;
    startClientX: number;
    startClientY: number;
    origin: CertificateLayoutElement;
  } | null>(null);

  const orderedElements = $derived(
    [...store.layout.elements].sort((leftElement, rightElement) => leftElement.zIndex - rightElement.zIndex)
  );

  function recomputeScale() {
    if (!viewport) return;

    const bounds = viewport.getBoundingClientRect();
    const horizontalScale = Math.max(0.2, (bounds.width - 48) / CERTIFICATE_PAGE_WIDTH);
    const verticalScale = Math.max(0.2, (bounds.height - 48) / CERTIFICATE_PAGE_HEIGHT);
    scale = Math.min(1, horizontalScale, verticalScale);
  }

  onMount(() => {
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(recomputeScale);
    resizeObserver.observe(viewport);
    recomputeScale();

    return () => resizeObserver.disconnect();
  });

  function textValue(element: Exclude<CertificateLayoutElement, CertificateImageElement>) {
    return element.type === 'variable' ? resolveCertificateVariable(element.variable, context) : element.text;
  }

  function imageSource(element: CertificateImageElement) {
    if (element.src) return element.src;
    if (element.role === 'logo') return context.organization.logoUrl;

    return undefined;
  }

  function commonStyle(element: CertificateLayoutElement) {
    return [
      `left:${element.x}px`,
      `top:${element.y}px`,
      `width:${element.width}px`,
      `height:${element.height}px`,
      `opacity:${element.opacity}`,
      `z-index:${element.zIndex}`,
      `transform:rotate(${element.rotation}deg)`
    ].join(';');
  }

  function textStyle(element: Exclude<CertificateLayoutElement, CertificateImageElement>) {
    const justifyContent =
      element.textAlign === 'left' ? 'flex-start' : element.textAlign === 'right' ? 'flex-end' : 'center';

    return [
      `justify-content:${justifyContent}`,
      `font-family:${FONT_STACKS[element.fontFamily]}`,
      `font-size:${element.fontSize}px`,
      `font-weight:${element.fontWeight}`,
      `font-style:${element.fontStyle}`,
      `line-height:${element.lineHeight}`,
      `text-align:${element.textAlign}`,
      `color:${element.color}`
    ].join(';');
  }

  function startDrag(event: PointerEvent, element: CertificateLayoutElement) {
    if (readOnly || element.locked || event.button !== 0) return;

    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    store.selectElement(element.id);
    store.beginInteraction();
    const elementSnapshot = $state.snapshot(element);
    interaction = {
      elementId: element.id,
      type: 'drag',
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: toCertificateLayoutElementSnapshot(elementSnapshot)
    };
  }

  function startResize(event: PointerEvent, element: CertificateLayoutElement, handle: CertificateResizeHandle) {
    if (readOnly || element.locked || event.button !== 0) return;

    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    store.beginInteraction();
    const elementSnapshot = $state.snapshot(element);
    interaction = {
      elementId: element.id,
      type: 'resize',
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: toCertificateLayoutElementSnapshot(elementSnapshot)
    };
  }

  function handlePointerMove(event: PointerEvent) {
    if (!interaction) return;

    const horizontalDelta = (event.clientX - interaction.startClientX) / scale;
    const verticalDelta = (event.clientY - interaction.startClientY) / scale;
    const origin = interaction.origin;

    if (interaction.type === 'drag') {
      store.updateElementLive(interaction.elementId, {
        x: origin.x + horizontalDelta,
        y: origin.y + verticalDelta
      });
      return;
    }

    const handle = interaction.handle ?? 'se';
    let x = origin.x;
    let y = origin.y;
    let width = origin.width;
    let height = origin.height;

    if (handle.includes('e')) width = origin.width + horizontalDelta;
    if (handle.includes('s')) height = origin.height + verticalDelta;
    if (handle.includes('w')) {
      width = origin.width - horizontalDelta;
      x = origin.x + horizontalDelta;
    }
    if (handle.includes('n')) {
      height = origin.height - verticalDelta;
      y = origin.y + verticalDelta;
    }

    if (origin.type === 'image' && origin.keepRatio) {
      const aspectRatio = origin.width / origin.height;
      if (handle === 'n' || handle === 's') width = height * aspectRatio;
      else height = width / aspectRatio;
    }

    store.updateElementLive(interaction.elementId, { x, y, width, height });
  }

  function finishPointerInteraction() {
    if (!interaction) return;

    store.finishInteraction();
    interaction = null;
  }

  const resizeHandles: CertificateResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
</script>

<div
  bind:this={viewport}
  class="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-auto p-6"
>
  <div
    class="relative shrink-0"
    style:width="{CERTIFICATE_PAGE_WIDTH * scale}px"
    style:height="{CERTIFICATE_PAGE_HEIGHT * scale}px"
  >
    <div
      class="absolute top-0 left-0 origin-top-left shadow-[0_20px_60px_rgba(15,23,42,0.24)]"
      style:width="{CERTIFICATE_PAGE_WIDTH}px"
      style:height="{CERTIFICATE_PAGE_HEIGHT}px"
      style:transform="scale({scale})"
      style:background-color={store.layout.page.backgroundColor}
      role="presentation"
      onpointerdown={(event) => {
        if (event.target === event.currentTarget) store.selectElement(null);
      }}
      onpointermove={handlePointerMove}
      onpointerup={finishPointerInteraction}
      onpointercancel={finishPointerInteraction}
    >
      {#if store.layout.page.backgroundImageUrl}
        <img
          class="pointer-events-none absolute inset-0 size-full object-cover"
          src={store.layout.page.backgroundImageUrl}
          alt=""
          style:opacity={store.layout.page.backgroundImageOpacity ?? 1}
        />
      {/if}

      {#each orderedElements as element (element.id)}
        {@const isSelected = !readOnly && store.selectedElementId === element.id}
        <div
          class="absolute touch-none select-none {readOnly ? '' : 'cursor-move'} {isSelected
            ? 'outline-2 outline-offset-2 outline-blue-500'
            : ''}"
          class:pointer-events-none={readOnly}
          style={commonStyle(element)}
          role="button"
          tabindex={readOnly ? undefined : 0}
          aria-label={element.name}
          onpointerdown={(event) => startDrag(event, element)}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') store.selectElement(element.id);
          }}
        >
          {#if element.type === 'image'}
            {@const source = imageSource(element)}
            {#if source}
              <img class="pointer-events-none size-full" src={source} alt="" style:object-fit={element.objectFit} />
            {/if}
          {:else}
            <div
              class="flex size-full items-center overflow-hidden [overflow-wrap:anywhere] whitespace-pre-wrap"
              style={textStyle(element)}
            >
              {textValue(element)}
            </div>
          {/if}

          {#if isSelected && !element.locked}
            {#each resizeHandles as handle (handle)}
              <button
                type="button"
                class="resize-handle absolute z-[1200] size-3 rounded-full border-2 border-white bg-blue-500 shadow"
                class:handle-nw={handle === 'nw'}
                class:handle-n={handle === 'n'}
                class:handle-ne={handle === 'ne'}
                class:handle-e={handle === 'e'}
                class:handle-se={handle === 'se'}
                class:handle-s={handle === 's'}
                class:handle-sw={handle === 'sw'}
                class:handle-w={handle === 'w'}
                aria-label={handle}
                onpointerdown={(event) => startResize(event, element, handle)}
              ></button>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="absolute right-4 bottom-4 rounded-full border bg-white/90 px-3 py-1 text-xs text-slate-700 shadow-sm">
    {Math.round(scale * 100)}%
  </div>
</div>

<style>
  .resize-handle {
    transform: translate(-50%, -50%);
  }
  .handle-nw {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }
  .handle-n {
    top: 0;
    left: 50%;
    cursor: ns-resize;
  }
  .handle-ne {
    top: 0;
    left: 100%;
    cursor: nesw-resize;
  }
  .handle-e {
    top: 50%;
    left: 100%;
    cursor: ew-resize;
  }
  .handle-se {
    top: 100%;
    left: 100%;
    cursor: nwse-resize;
  }
  .handle-s {
    top: 100%;
    left: 50%;
    cursor: ns-resize;
  }
  .handle-sw {
    top: 100%;
    left: 0;
    cursor: nesw-resize;
  }
  .handle-w {
    top: 50%;
    left: 0;
    cursor: ew-resize;
  }
</style>
