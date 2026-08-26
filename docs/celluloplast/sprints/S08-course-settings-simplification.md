# S08 — Simplification des paramètres de formation

> **Statut** : livré · **Aucune migration DB** · Prérequis S05–S07

---

# Goal

Simplifier l’écran `Settings` d’une formation Celluloplast pour ne conserver que les réglages utiles au parcours V1 : nom, description, image, certificat, publication, assignation, suppression.

---

# Existing Settings

L’écran upstream `apps/dashboard/src/lib/features/course/pages/settings.svelte` exposait de nombreux paramètres ClassroomIO :

- type de cours
- lien public / landing
- tags
- conformité / deadline / seuil / final exercise
- welcome email
- order tabs
- content grouping
- progression mode
- lesson download / course download
- options publiques / marketing

Le tout persistait via `courseApi.update(...)` sans nouveau moteur métier.

---

# Visible Settings

La version Celluloplast V1 conserve uniquement :

- Image de couverture
- Nom de la formation
- Description
- Certificat activé / désactivé
- Publication
- CTA d’assignation des employés
- Suppression de la formation

Les règles de visibilité sont centralisées dans `apps/dashboard/src/lib/celluloplast/course-authoring.ts`.

---

# Hidden Settings

Masqués dans le parcours Celluloplast :

- type de formation
- tags
- paramètres COMPLIANCE
- seuil de certification
- final exercise / minimum score
- expiration / recertification
- landing page / lien public
- IA / AI Tutor
- welcome email
- order tabs / progression mode / content grouping
- lesson download / course download
- marketing / social / news feed / options publiques

Le backend correspondant n’est pas supprimé.

---

# Default Values

| Champ | Valeur |
|-------|--------|
| `creationRole` | `ADMIN_ONLY` |
| `type` | `SELF_PACED` à la création Celluloplast |
| `certificate.threshold` | `100` |
| `certificate.isDownloadable` | `true` par défaut à la création |
| `isPublished` | `false` à la création |

Le seuil `100` reste caché dans l’UI simplifiée.

---

# Publication Flow

- Statut affiché : `Brouillon` ou `Publiée`
- Action principale : `Publier la formation` / `Retirer de la publication`
- Réutilisation de `isPublished`
- `metadata.allowNewStudent` suit l’état publié/dépublié

Pas de nouvel enum de statut.

---

# Certificate Flow

- UI simplifiée : `Délivrer un certificat à la fin`
- Mapping : `certificate.isDownloadable`
- Le seuil reste géré en interne et non exposé

Pas de certificat de module, pas d’achievement, pas de recertification.

---

# Assignment Flow

- CTA : `Assigner des employés`
- Cible : `/courses/{id}/people?add=true`
- Désactivé tant que la formation n’est pas publiée

Le mécanisme d’enrollment upstream est réutilisé tel quel.

---

# Authorization

- **ADMIN** : peut modifier les settings, publier/dépublier, activer/désactiver le certificat, assigner, supprimer
- **TUTOR** : permissions inchangées, limité aux formations qu’il peut gérer upstream
- **STUDENT** : aucun accès à l’écran `Settings`
- **Création** : `ADMIN_ONLY` (pas d’ouverture implicite aux TUTOR)

---

# Files Changed

### Créé

- `docs/celluloplast/sprints/S08-course-settings-simplification.md`

### Modifiés

- `apps/dashboard/src/lib/celluloplast/course-authoring.ts`
- `apps/dashboard/src/lib/features/course/pages/settings.svelte`
- `apps/dashboard/src/lib/features/course/utils/settings-store.ts`
- `apps/dashboard/src/lib/utils/translations/en.json`
- `apps/dashboard/src/lib/utils/translations/fr.json`
- `apps/dashboard/src/lib/utils/translations/de.json`
- `apps/dashboard/src/lib/utils/translations/es.json`
- `apps/dashboard/src/lib/utils/translations/pt.json`
- `apps/dashboard/src/lib/utils/translations/da.json`
- `apps/dashboard/src/lib/utils/translations/pl.json`
- `apps/dashboard/src/lib/utils/translations/ru.json`
- `apps/dashboard/src/lib/utils/translations/vi.json`
- `apps/dashboard/src/lib/utils/translations/hi.json`

---

# Verification

| Check | Résultat |
|-------|----------|
| Audit S05–S07 + couche Celluloplast | OK |
| `pnpm format:check` | OK |
| `pnpm --filter @cio/dashboard^... build` | OK |
| `pnpm --filter @cio/dashboard build` | OK (~3m58s) |
| `ReadLints` sur fichiers S08 | OK |
| Migration DB | Aucune |

Checklist manuelle restante : ADMIN, TUTOR, STUDENT, brouillon/publiée, certificat on/off, aucune option IA/compliance/type visible.

---

# Known Limitations

- Les valeurs avancées cachées restent persistées côté modèle upstream
- Les formations historiques non `SELF_PACED` ne sont pas reconfigurables depuis l’écran simplifié
- Les locales hors FR/EN reçoivent des chaînes `celluloplast_settings` en anglais
- E2E navigateur non ajouté dans ce sprint

---

# Follow-up

**S09 recommandé** : simplifier le parcours d’assignation / audience côté Celluloplast sans recréer l’enrollment, et homogénéiser le vocabulaire restant “lesson/course” hors écran Settings.
