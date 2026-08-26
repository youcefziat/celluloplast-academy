# S09 — Simplification de l’assignation des employés

> **Statut** : livré · **Aucune migration DB** · Prérequis S07–S08

---

# Goal

Simplifier le parcours Celluloplast pour assigner des employés à une formation, en réutilisant le mécanisme d’enrollment ClassroomIO (`/courses/{id}/people?add=true`).

---

# Existing ClassroomIO Flow

| Élément | Emplacement |
|---------|-------------|
| Page | `/courses/{id}/people` → `people.svelte` |
| CTA | `?add=true` → `InvitationModal` |
| Liste | `courseApi.group.people` |
| Sélection | `ExistingStudentsSection` + `MultiSelectList` |
| API assignation | `POST /organization/audience/assign-courses` via `orgApi.assignAudienceToCourses` |
| Doublons | exclus côté UI (`getAvailableStudents`) + `alreadyEnrolled` côté API |
| Permissions | `courseTeamMemberMiddleware` (ADMIN org ou TUTOR du cours) |
| Retrait | `DELETE /course/:courseId/members/:memberId` (hard delete `groupmember`) |

---

# Celluloplast Assignment Flow

```text
Formation
→ Assigner des employés (/people?add=true)
→ rechercher / cocher des employés non déjà inscrits
→ Assigner
→ snackbar de confirmation
→ retour à « Employés inscrits »
```

---

# Data Source

- Employés disponibles : `orgApi.getOrgAudience` (audience org existante)
- Déjà inscrits : `courseApi.group.people` filtrés `ROLE.STUDENT`
- Date d’assignation : `groupmember.createdAt` déjà présent

Pas de nouvelle requête SQL, pas de N+1 ajouté.

---

# Enrollment Reuse

Réutilisation stricte de :

- `orgApi.assignAudienceToCourses`
- protection `alreadyEnrolled`
- refresh cours via `courseApi.refreshCourse`

Aucune nouvelle API d’inscription.

---

# Authorization

| Rôle | Comportement |
|------|--------------|
| ADMIN | voit / assigne sur toute formation qu’il gère |
| TUTOR | inchangé : uniquement si `courseTeamMember` |
| STUDENT | aucun accès (layout `RoleBasedSecurity` + middleware) |

Création de formation reste `ADMIN_ONLY` (S08). Aucun élargissement de droits.

---

# UI

### Liste

- Titre : `Employés inscrits`
- Colonnes : Employé · E-mail · Date d’assignation · Action (Voir)
- Recherche nom / e-mail
- Filtre de rôle masqué
- Liste limitée aux apprenants (`STUDENT`)

### Modal

- Titre : `Assigner des employés`
- Multi-sélection bulk upstream
- Onglet tuteurs masqué
- Invitation bulk e-mail / CSV masquée
- Bouton Annuler + Assigner
- Fermeture auto après succès

---

# Vocabulary

| Upstream | Celluloplast FR |
|----------|-----------------|
| People | Employés inscrits |
| Invite / Add Students | Assigner des employés |
| Audience / Members | Employés |
| Enrollment | Inscription / Affectation (non exposé) |

Identifiants internes inchangés.

---

# Files Changed

### Créés

- `apps/dashboard/src/lib/celluloplast/people.ts`
- `docs/celluloplast/sprints/S09-employee-assignment.md`

### Modifiés

- `apps/dashboard/src/lib/features/course/components/people/invitation-modal.svelte`
- `apps/dashboard/src/lib/features/course/pages/people.svelte`
- `apps/dashboard/src/routes/(app)/courses/[id]/people/+layout.svelte`
- locales `en/fr/de/es/pt/da/pl/ru/vi/hi` (`celluloplast_people` + vocab FR/EN people)

---

# Verification

| Check | Résultat |
|-------|----------|
| Audit flow people / assign-courses | OK |
| Prettier (fichiers S09) | OK |
| JSON locales | OK |
| `pnpm --filter @cio/dashboard build` | OK (~3m14s) |
| Migration DB | Aucune |
| API build | Non requis (dashboard only) |

Checklist manuelle restante : ADMIN 1/N assignations, doublon exclu, recherche vide, TUTOR permissions, STUDENT sans accès.

---

# Known Limitations

- **Retrait hors scope** : `DELETE members` hard-delete la ligne `groupmember` (progression + `certificate_earned_at`). Bouton masqué.
- Progression / statut non ajoutés en colonnes (données non présentes simplement sur la liste people).
- Invitation d’employés hors org (CSV / e-mail) masquée en V1.
- Locales hors FR/EN : clés `celluloplast_people` en anglais.

---

# Follow-up

**S10 recommandé** : UX apprenant « Mes formations » / vocabulaire restant, ou raffinement Audience org (Employés) sans sync RH / CSV / Entra ID.
