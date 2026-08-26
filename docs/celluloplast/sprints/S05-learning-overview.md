# S05 — Learning Overview (progression organisationnelle)

> **Statut** : livré · **Aucune migration DB** · Prérequis S03/S04

---

# Goal

Remplacer `Progression → /compliance` (filtre `COMPLIANCE`) par une vue org type-agnostique (`SELF_PACED`, `COMPLIANCE`, …).

---

# Existing Reused Components

- `calcCourseProgressPercent`, `isExerciseCompletedSql`
- `orgTeamMemberMiddleware` + scoping tuteur = `getOrgCourses({ profileId })`
- UI `@cio/ui` (Page, Table, Card, Badge, Search, Select)
- Nav fork `lib/celluloplast/navigation.ts`

---

# API Design

`GET /dash/learning-overview?orgId=`

- Middleware : `authMiddleware` + `orgTeamMemberMiddleware`
- Validation : `ZDashLearningOverview`
- Garde : query `orgId` === header `cio-org-id`
- Data : `{ learners[], courses[] }` avec `progressPercent`, counts leçons/exercices, `status`, `lastActivityAt`

---

# Database Query

`getOrgLearningOverviewRows` — **1 requête** SQL, sous-requêtes corrélées, **sans** `eq(course.type, 'COMPLIANCE')`, formations `ACTIVE` uniquement. Option `tutorProfileId` via `EXISTS`.

---

# Authorization

| Rôle | Nav | Données |
|------|-----|---------|
| ADMIN | `/progress` | toute l'org |
| TUTOR | `/progress` | ses formations (`groupmember`) |
| STUDENT | non | 403 |

---

# Progress Calculation

```
(lessonsCompleted + exercisesCompleted) / (lessonsTotal + exercisesTotal) × 100
```

Statuts dérivés : `NOT_STARTED` (0) · `IN_PROGRESS` · `COMPLETED` (≥100). Module non stocké.

---

# UI

`/org/{slug}/progress` — tableau + recherche employé + filtre formation + filtre statut + pagination client (50).

Nav : `Progression → /progress` (plus `/compliance`).

---

# Performance Considerations

Une requête agrégée (pas le N+1 de `getCourseAnalytics`). Filtres/pagination client V1.

---

# Files Changed

**Créés** : `packages/db/.../learning-overview.ts`, `apps/dashboard/.../learning-overview/**`, `org/[slug]/progress/+page.svelte`, ce doc.

**Modifiés** : validation dash, export dash queries, `services/dash.ts`, `routes/dash/stats.ts`, `celluloplast/navigation.ts`, 10 locales (`celluloplast_progress`).

---

# Verification

| Étape | Résultat |
|-------|----------|
| Prettier fichiers touchés | OK |
| `@cio/utils` / `@cio/db` / `@cio/api^...` / `@cio/api` build | OK |
| `@cio/dashboard` build | Échec `ENOSPC` (disque plein) — à relancer après libération d'espace |

Checklist manuelle : ADMIN/TUTOR/STUDENT, SELF_PACED/COMPLIANCE, 3 statuts, isolation org.

---

# Known Limitations

- Certifications S03 toujours plafonnées (`dash/stats`)
- `/compliance` accessible par URL directe
- Dernière activité = leçons seulement
- Locales non FR/EN en anglais pour les nouvelles clés

---

# Follow-up (S06 recommandé)

Page Certifications org exhaustive : réutiliser learning-overview filtré `certificateEarnedAt IS NOT NULL`, remplacer `dash/stats`. Pas de certificats module / recertification / PDF archivé / achievements.
