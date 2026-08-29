import {
  createCertificateLayoutPreset,
  CERTIFICATE_PAGE_HEIGHT,
  CERTIFICATE_PAGE_WIDTH,
  DEFAULT_CERTIFICATE_LAYOUT,
  migrateLegacyCertificateDesign,
  type CertificateImageElement,
  type CertificateLayout,
  type CertificateLayoutElement,
  type CertificateTemplateId,
  type CertificateVariable
} from '@cio/certificates';
import { get } from 'svelte/store';

import { orgApi } from '$features/org/api/org.svelte';
import { currentOrg } from '$lib/utils/store/org';
import {
  assignCertificateLayerOrder,
  clampCertificateElement,
  cloneCertificateLayout,
  cloneCertificateLayoutElement,
  createCertificateElementId,
  createImageElement,
  createTextElement,
  createVariableElement,
  normalizeCertificateLayerOrder
} from '../utils/layout';
import type { CertificateDesignerMode, CertificateDesignerPanel, CertificateLayoutElementPatch } from '../utils/types';

const HISTORY_LIMIT = 50;
const PRESET_ELEMENT_IDS = new Set([
  'title',
  'organization-logo',
  'awarded-label',
  'student-name',
  'course-label',
  'course-name',
  'certificate-date',
  'organization-name'
]);

function toDesignerLayoutSnapshot(layout: CertificateLayout): CertificateLayout {
  const reactiveSnapshot = $state.snapshot(layout);

  return cloneCertificateLayout(reactiveSnapshot);
}

function toDesignerElementSnapshot(element: CertificateLayoutElement): CertificateLayoutElement {
  const reactiveSnapshot = $state.snapshot(element);

  return cloneCertificateLayoutElement(reactiveSnapshot);
}

function layoutFingerprint(layout: CertificateLayout): string {
  return JSON.stringify(toDesignerLayoutSnapshot(layout));
}

function applyElementPatch(
  currentElement: CertificateLayoutElement,
  patch: CertificateLayoutElementPatch
): CertificateLayoutElement {
  const updatedElement = { ...currentElement, ...patch } as CertificateLayoutElement;
  const shouldKeepRatio = currentElement.type === 'image' && (patch.keepRatio ?? currentElement.keepRatio);

  if (!shouldKeepRatio || currentElement.width <= 0 || currentElement.height <= 0) return updatedElement;

  const aspectRatio = currentElement.width / currentElement.height;
  if (patch.width !== undefined && patch.height === undefined) {
    updatedElement.height = patch.width / aspectRatio;
  } else if (patch.height !== undefined && patch.width === undefined) {
    updatedElement.width = patch.height * aspectRatio;
  }

  return updatedElement;
}

class CertificateDesignerStore {
  activePanel = $state<CertificateDesignerPanel>('add');
  mode = $state<CertificateDesignerMode>('edit');
  layout = $state<CertificateLayout>(toDesignerLayoutSnapshot(DEFAULT_CERTIFICATE_LAYOUT));
  selectedElementId = $state<string | null>(null);
  isSaving = $state(false);
  isUploading = $state(false);
  history = $state<CertificateLayout[]>([]);
  future = $state<CertificateLayout[]>([]);
  initialSnapshot = $state(layoutFingerprint(DEFAULT_CERTIFICATE_LAYOUT));
  #initializedOrgId: string | null = null;
  #interactionStart: CertificateLayout | null = null;
  #copiedElement: CertificateLayoutElement | null = null;

  readonly selectedElement = $derived(
    this.layout.elements.find((element) => element.id === this.selectedElementId) ?? null
  );
  readonly isDirty = $derived(layoutFingerprint(this.layout) !== this.initialSnapshot);
  readonly canUndo = $derived(this.history.length > 0);
  readonly canRedo = $derived(this.future.length > 0);

  syncFromOrg(orgId: string, force = false) {
    if (!force && this.#initializedOrgId === orgId) return;

    const org = get(currentOrg);
    const settings = org.settings && typeof org.settings === 'object' ? org.settings : {};
    const storedDesign = (settings as Record<string, unknown>).certificateDesign;
    const migratedLayout = migrateLegacyCertificateDesign(storedDesign);

    this.layout = toDesignerLayoutSnapshot(migratedLayout);
    this.initialSnapshot = layoutFingerprint(migratedLayout);
    this.selectedElementId = null;
    this.history = [];
    this.future = [];
    this.#initializedOrgId = orgId;
  }

  selectElement(elementId: string | null) {
    this.selectedElementId = elementId;
    if (elementId) this.activePanel = 'properties';
  }

  private commit(nextLayout: CertificateLayout, selectedElementId = this.selectedElementId) {
    this.history = [...this.history.slice(-(HISTORY_LIMIT - 1)), toDesignerLayoutSnapshot(this.layout)];
    this.future = [];
    this.layout = toDesignerLayoutSnapshot(nextLayout);
    this.selectedElementId = selectedElementId;
  }

  beginInteraction() {
    this.#interactionStart = toDesignerLayoutSnapshot(this.layout);
  }

  updateElementLive(elementId: string, patch: CertificateLayoutElementPatch) {
    const index = this.layout.elements.findIndex((element) => element.id === elementId);
    if (index < 0) return;

    const currentElement = this.layout.elements[index];
    const patchedElement = applyElementPatch(currentElement, patch);
    const updatedElement = clampCertificateElement(patchedElement);
    this.layout.elements[index] = updatedElement;
  }

  finishInteraction() {
    if (!this.#interactionStart) return;

    if (layoutFingerprint(this.#interactionStart) !== layoutFingerprint(this.layout)) {
      this.history = [...this.history.slice(-(HISTORY_LIMIT - 1)), this.#interactionStart];
      this.future = [];
    }
    this.#interactionStart = null;
  }

  updateElement(elementId: string, patch: CertificateLayoutElementPatch) {
    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    const index = nextLayout.elements.findIndex((element) => element.id === elementId);
    if (index < 0) return;

    const currentElement = nextLayout.elements[index];
    const patchedElement = applyElementPatch(currentElement, patch);
    nextLayout.elements[index] = clampCertificateElement(patchedElement);
    this.commit(nextLayout, elementId);
  }

  addText() {
    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    const element = createTextElement(nextLayout);
    nextLayout.elements.push(element);
    this.commit(nextLayout, element.id);
  }

  addVariable(variable: CertificateVariable) {
    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    const element = createVariableElement(nextLayout, variable);
    nextLayout.elements.push(element);
    this.commit(nextLayout, element.id);
  }

  addImage(role: CertificateImageElement['role'], src?: string) {
    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    const element = createImageElement(nextLayout, role, src);
    nextLayout.elements.push(element);
    this.commit(nextLayout, element.id);
  }

  setBackgroundImage(backgroundImageUrl: string) {
    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    nextLayout.page.backgroundImageUrl = backgroundImageUrl;
    nextLayout.page.backgroundImageOpacity = 1;
    this.commit(nextLayout, null);
  }

  clearBackgroundImage() {
    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    delete nextLayout.page.backgroundImageUrl;
    this.commit(nextLayout, null);
  }

  applyTemplate(templateId: CertificateTemplateId) {
    const preset = createCertificateLayoutPreset(templateId);
    const overlays = toDesignerLayoutSnapshot(this.layout).elements.filter(
      (element) => !PRESET_ELEMENT_IDS.has(element.id)
    );
    preset.elements = normalizeCertificateLayerOrder([...preset.elements, ...overlays]);
    this.commit(preset, null);
  }

  deleteSelected() {
    if (!this.selectedElementId) return;

    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    nextLayout.elements = nextLayout.elements.filter((element) => element.id !== this.selectedElementId);
    this.commit(nextLayout, null);
  }

  duplicateSelected() {
    const selectedElement = this.selectedElement;
    if (!selectedElement) return;

    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    const duplicatedElement = toDesignerElementSnapshot(selectedElement);
    duplicatedElement.id = createCertificateElementId(selectedElement.type);
    duplicatedElement.name = `${selectedElement.name.slice(0, 112)} (copie)`;
    duplicatedElement.x = Math.min(selectedElement.x + 24, CERTIFICATE_PAGE_WIDTH - selectedElement.width);
    duplicatedElement.y = Math.min(selectedElement.y + 24, CERTIFICATE_PAGE_HEIGHT - selectedElement.height);
    duplicatedElement.zIndex = Math.max(...nextLayout.elements.map((element) => element.zIndex), 0) + 1;
    nextLayout.elements.push(duplicatedElement);
    this.commit(nextLayout, duplicatedElement.id);
  }

  copySelected() {
    this.#copiedElement = this.selectedElement ? toDesignerElementSnapshot(this.selectedElement) : null;
  }

  pasteCopied() {
    if (!this.#copiedElement) return;

    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    const pastedElement = toDesignerElementSnapshot(this.#copiedElement);
    pastedElement.id = createCertificateElementId(pastedElement.type);
    pastedElement.name = `${pastedElement.name.slice(0, 112)} (copie)`;
    pastedElement.x = Math.min(pastedElement.x + 24, CERTIFICATE_PAGE_WIDTH - pastedElement.width);
    pastedElement.y = Math.min(pastedElement.y + 24, CERTIFICATE_PAGE_HEIGHT - pastedElement.height);
    pastedElement.zIndex = Math.max(...nextLayout.elements.map((element) => element.zIndex), 0) + 1;
    nextLayout.elements.push(pastedElement);
    this.commit(nextLayout, pastedElement.id);
  }

  moveSelectedLayer(direction: 'front' | 'back') {
    const selectedElement = this.selectedElement;
    if (!selectedElement) return;

    const nextLayout = toDesignerLayoutSnapshot(this.layout);
    const orderedElements = normalizeCertificateLayerOrder(nextLayout.elements);
    const selectedIndex = orderedElements.findIndex((element) => element.id === selectedElement.id);
    const [movingElement] = orderedElements.splice(selectedIndex, 1);

    if (direction === 'front') orderedElements.push(movingElement);
    else orderedElements.unshift(movingElement);

    nextLayout.elements = assignCertificateLayerOrder(orderedElements);
    this.commit(nextLayout, selectedElement.id);
  }

  alignSelected(alignment: 'left' | 'right' | 'horizontal' | 'vertical') {
    const element = this.selectedElement;
    if (!element) return;

    const patch: CertificateLayoutElementPatch = {};
    if (alignment === 'left') patch.x = 0;
    if (alignment === 'right') patch.x = CERTIFICATE_PAGE_WIDTH - element.width;
    if (alignment === 'horizontal') patch.x = (CERTIFICATE_PAGE_WIDTH - element.width) / 2;
    if (alignment === 'vertical') patch.y = (CERTIFICATE_PAGE_HEIGHT - element.height) / 2;
    this.updateElement(element.id, patch);
  }

  undo() {
    const previous = this.history.at(-1);
    if (!previous) return;

    this.future = [toDesignerLayoutSnapshot(this.layout), ...this.future].slice(0, HISTORY_LIMIT);
    this.layout = toDesignerLayoutSnapshot(previous);
    this.history = this.history.slice(0, -1);
    if (!this.layout.elements.some((element) => element.id === this.selectedElementId)) {
      this.selectedElementId = null;
    }
  }

  redo() {
    const next = this.future[0];
    if (!next) return;

    this.history = [...this.history.slice(-(HISTORY_LIMIT - 1)), toDesignerLayoutSnapshot(this.layout)];
    this.layout = toDesignerLayoutSnapshot(next);
    this.future = this.future.slice(1);
  }

  discard() {
    this.layout = JSON.parse(this.initialSnapshot) as CertificateLayout;
    this.selectedElementId = null;
    this.history = [];
    this.future = [];
  }

  resetToDefault() {
    this.commit(toDesignerLayoutSnapshot(DEFAULT_CERTIFICATE_LAYOUT), null);
  }

  async save() {
    const org = get(currentOrg);
    if (!org.id || this.isSaving || this.isUploading) return;

    this.isSaving = true;
    try {
      orgApi.success = false;
      const certificateDesign = toDesignerLayoutSnapshot(this.layout);
      await orgApi.update(org.id, { settings: { certificateDesign } });

      if (orgApi.success) {
        this.initialSnapshot = layoutFingerprint(certificateDesign);
        this.history = [];
        this.future = [];
      }
    } finally {
      this.isSaving = false;
    }
  }
}

export const certificateDesignerStore = new CertificateDesignerStore();
