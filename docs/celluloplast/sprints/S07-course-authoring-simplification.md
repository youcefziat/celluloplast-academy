# S07 — Simplification métier et création de formations

> **Statut** : livré · **Aucune migration DB** · Prérequis S03–S06

---

# Goal

Simplifier la création/édition d’une formation Celluloplast (Formation → Module → Cours) en réutilisant ClassroomIO, sans réécrire le moteur.

---

# Existing ClassroomIO Authoring Flow

- Création : `/org/{slug}/courses?create=true` → `NewCourseModal` → `POST /course` (ADMIN only)
- Éditeur : `/courses/{id}/…` (lessons, people, certificates, settings…)
- Modules : `course_section` via `POST/PUT/DELETE …/section`
- Contenu : Lesson / Exercise (+ Section)
- Publication : `isPublished` (pas DRAFT/ACTIVE DB)
- Assignation : `/courses/{id}/people?add=true`

---

# Celluloplast Vocabulary

| Technique | UI (FR) |
|-----------|---------|
| Course | Formation |
| Section | Module |
| Lesson | Cours |
| Exercise | Quiz |
| People | Employés |
| Unpublished | Brouillon |
| Published | Publiée |

Tables/API inchangées.

---

# Hidden Features

Via `CELLULOPLAST_V1.ai` + `CELLULOPLAST_HIDDEN_COURSE_NAV_IDS` :

- Assistant header, Ask-AI bar, panneau AI
- Option « Use AI » à la création d’exercice
- AI sur le textarea de création
- Nav : AI Tutor, Landing page, News feed
- Bouton « View course site » (landing marketing)
- Types de formation LIVE / COMPLIANCE / PUBLIC à la création

Backend IA non supprimé.

---

# Default Values

| Champ | Valeur |
|-------|--------|
| `type` | `SELF_PACED` |
| `isPublished` | `false` (brouillon) |
| `certificate.isDownloadable` | `true` (après create) |
| `certificate.threshold` | `100` |

---

# Course Creation

Modal 1 étape : Nom + Description → Créer.  
Redirection : `/courses/{id}/lessons`.

---

# Module Management

CRUD `course_section` inchangé ; libellés « Module » / « Ajouter un module ».

---

# Lesson Management

Types conservés : **Module**, **Cours** (lesson), **Quiz** (exercise).  
Matériaux lesson : vidéo, note, document, slide (inchangés côté éditeur).

---

# Certificate Configuration

Toggle : « Délivrer un certificat à la fin » (`isDownloadable`).  
Seuil 100 % non exposé dans le parcours simplifié (reste dans Settings avancés).

---

# Publishing

`isPublished` ; CTA header « Publier la formation » → `/settings#publish`.  
Labels Brouillon / Publiée.

---

# Assignment Flow

CTA header « Assigner des employés » → `/people?add=true` (InvitationModal upstream).

---

# Authorization

- Création : ADMIN only (upstream `orgAdminMiddleware`)
- Édition : ADMIN org ou team cours (TUTOR)

---

# Files Changed

**Créés** : `lib/celluloplast/course-authoring.ts`, `docs/.../S07-course-authoring-simplification.md`

**Modifiés** : `navigation.ts`, `new-course-modal.svelte`, `course-header.svelte`, `courses/[id]/+layout.svelte`, `content-create-modal.svelte`, `exercise-create-stepper.svelte`, `certificate-settings.svelte`, `course.svelte.ts` (create callback), i18n EN/FR (+ authoring keys autres locales)

---

# Verification

| Check | Résultat |
|-------|----------|
| Prettier (fichiers S07) | OK |
| `pnpm --filter @cio/dashboard build` | OK (exit 0, ~4m27s) |
| Migration DB | Aucune |
| API build | Non requis (dashboard only) |

---

# Known Limitations

- Settings avancés encore riches (type, tags, etc.)
- Seuil certificat encore visible dans Settings
- Création réservée ADMIN (pas d’élargissement TUTOR)
- Vocabulaire FR/EN prioritaire ; autres locales : clés authoring en EN
- Quelques libellés FR périphériques peuvent encore dire « leçon » hors parcours création/contenu
- E2E navigateur non exécuté dans ce sprint (build dashboard OK)

---

# Follow-up

**S08** : ops VPS / déploiement, ou raffinement Settings (masquer champs inutiles) — pas de certificats module / achievements.
