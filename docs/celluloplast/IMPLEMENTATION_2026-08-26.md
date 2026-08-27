# Celluloplast Academy — Implémentation du 26 août 2026

> Journal des changements livrés sur la branche `main` : tenant unique Celluloplast, création d’employés (formulaire + CSV), correctifs org settings, et durcissement seed/navigation.

---

## 1. Création d’employés (`/org/{slug}/audience`)

### Objectif

Permettre aux admins d’ajouter des employés avec champs RH, par **invitation email** (l’employé définit son mot de passe via `/invite/{token}`).

### Schéma DB — migration `0007_organizationmember_hr_fields`

Nouvelles colonnes sur `organizationmember` :

| Colonne | Type | Description |
|---------|------|-------------|
| `first_name` | text | Prénom |
| `last_name` | text | Nom |
| `job_title` | text | Poste |
| `department` | text | Département |
| `manager_member_id` | bigint FK | Référence self → `organizationmember.id` (`ON DELETE SET NULL`) |

Fichiers :

- `packages/db/src/schema.ts`
- `packages/db/src/migrations/0007_organizationmember_hr_fields.sql`
- `packages/db/src/migrations/meta/_journal.json`

**Appliquer la migration** (Docker) :

```powershell
docker exec celluloplast-api sh -c "cd /app/packages/db && pnpm db:migrate"
```

### API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/organization/audience` | `POST` | Crée un employé + invite email |
| `/organization/audience/import` | `POST` | Import CSV (legacy `recipientCsv` ou `rows[]`) |

Services : `apps/api/src/services/organization/audience.ts`

- `createAudienceMember` — membre STUDENT pending + champs RH + invite
- `importAudienceMembers` — 2 passes manager (création puis liaison par email manager)
- Réponse enrichie : `warnings[]` (manager introuvable, email invalide, etc.)

Validation Zod : `packages/utils/src/validation/organization/audience.ts`

- `ZCreateAudienceMember` — email, prénom, nom, poste, département, `managerMemberId` ou `managerEmail`
- `ZImportAudienceMembers` — `rows[]` (max 500) ou `recipientCsv` rétrocompatible

Sync fullname à l’acceptation d’invite : `apps/api/src/services/organization/invite.ts`  
Si `firstName`/`lastName` présents → `profile.fullname = trim(firstName + ' ' + lastName)` quand le fullname est vide ou dérivé de l’email.

Liste audience : `packages/db/src/queries/organization/organization.ts`  
Retourne poste, département, manager `{ id, email, name }`.

### Dashboard UI

| Fichier | Rôle |
|---------|------|
| `routes/(app)/org/[slug]/audience/+page.svelte` | Boutons **Ajouter un employé** + **Importer CSV** |
| `features/audience/components/create-audience-member-dialog.svelte` | Dialog formulaire (manager = Select des membres existants) |
| `features/audience/pages/import.svelte` | Import CSV multi-colonnes, aperçu, modèle téléchargeable |
| `features/audience/utils/audience-csv.ts` | Parser CSV (en-têtes FR/EN) |
| `features/audience/components/audience-table.svelte` | Colonnes Poste, Département, Manager |
| `features/audience/components/audience-member-row.svelte` | Affichage lignes HR |
| `features/org/api/org.svelte.ts` | `createAudienceMember`, `importAudienceMembers` |

### CSV — format attendu

```csv
email,firstName,lastName,jobTitle,department,managerEmail
alice@example.com,Alice,Martin,Technicienne,Production,
bob@example.com,Bob,Dupont,Responsable,Production,alice@example.com
```

En-têtes alternatifs acceptés : `mail`, `prenom`/`prénom`, `nom`, `poste`, `departement`/`département`, `manager`.

### Recette employés

```text
[ ] Bouton « Ajouter un employé » ouvre le dialog
[ ] Création → statut Pending + email invite (ou job queue si SMTP absent)
[ ] Import CSV 2+ lignes avec manager croisé → manager lié en passe 2
[ ] Acceptation invite → compte + fullname sync
[ ] Table : colonnes Nom, Email, Poste, Département, Manager, Statut
```

---

## 2. Paramètres organisation — correctif Enregistrer

### Problème

Sur `/org/{slug}/settings/org`, cliquer **Enregistrer** ne persistait ni le nom ni la photo.

### Causes

1. La page parente appelait `handleUpdate` via `bind:this` sur le composant enfant — appel parfois silencieux.
2. Le nom était lié directement au store `$currentOrg.name` (binding peu fiable).
3. L’upload avatar échouait sans message si MinIO/storage était indisponible.

### Correctifs

- `features/settings/pages/org.svelte` — état local `draftName`, barre `Page.SettingsActions` intégrée, handler `handleUpdate` direct
- `features/org/api/org.svelte.ts` — try/catch sur upload avatar avec snackbar d’erreur
- `routes/(app)/org/[slug]/settings/org/+page.svelte` — simplifié (`<OrgPage />` uniquement)

### Recette

```text
[ ] Modifier le nom (≥ 5 caractères) → barre unsaved → Enregistrer → snackbar succès
[ ] Recharger la page → nom persisté
[ ] Changer la photo → Enregistrer → avatar mis à jour (MinIO requis)
```

---

## 3. Tenant unique Celluloplast

### Problème

Le seed upstream créait plusieurs orgs demo (Udemy, Coursera, Skillshare). Un admin pouvait apparaître comme étudiant ou voir du contenu d’autres tenants.

### Correctifs

| Zone | Changement |
|------|------------|
| `lib/celluloplast/org-context.ts` | Filtre orgs → Celluloplast uniquement en self-hosted |
| `lib/features/app/init.svelte.ts` | Résolution rôle/org cohérente |
| `packages/db/src/utils/seed/*` | Seed Celluloplast seul (`celluloplast-organization.ts`) |
| `packages/db/src/scripts/celluloplast-patch-primary-org.ts` | Script patch DB existante |
| `scripts/celluloplast/patch-primary-org.ps1` | Wrapper PowerShell |

### Landing / catalogue public

- `lib/celluloplast/landing.ts`, `landing-page.ts`, `landing.server.ts`
- `exploreCatalog: false` — pas de redirection catalogue public `/courses` pour les visiteurs connectés
- `routes/(org-site)/courses/+page.server.ts` — comportement aligné

---

## 4. i18n & traductions

Clés ajoutées dans `apps/dashboard/src/lib/utils/translations/en.json` :

- `audience.create.*` — formulaire ajout employé
- `audience.job_title`, `audience.department`, `audience.manager`
- `audience.import.*` — CSV (modèle, aperçu, upload)

Locales synchronisées : `fr.json` (manuel FR), autres via merge/`pnpm translate`.

---

## 5. Autres correctifs

| Fichier | Fix |
|---------|-----|
| `routes/(org-site)/course/[slug]/lesson/+layout.svelte` | Import `t` manquant (build Docker) |
| `docs/celluloplast/LOCAL_TEST_GUIDE.md` | Migration RH, recette employés |

---

## 6. Déploiement Docker local

Après pull :

```powershell
docker compose -f docker-compose.celluloplast.yaml build api dashboard
docker compose -f docker-compose.celluloplast.yaml up -d
docker exec celluloplast-api sh -c "cd /app/packages/db && pnpm db:migrate"
```

URLs :

- Dashboard : http://localhost:3082 (ou http://127.0.0.1:3082)
- API : http://localhost:3081

---

## 7. Fichiers principaux (index)

```
packages/db/src/migrations/0007_organizationmember_hr_fields.sql
packages/db/src/schema.ts
packages/db/src/queries/organization/organization.ts
packages/utils/src/validation/organization/audience.ts
apps/api/src/services/organization/audience.ts
apps/api/src/services/organization/invite.ts
apps/api/src/routes/organization/organization.ts
apps/dashboard/src/lib/features/audience/**
apps/dashboard/src/lib/features/settings/pages/org.svelte
apps/dashboard/src/lib/celluloplast/**
docs/celluloplast/LOCAL_TEST_GUIDE.md
docs/celluloplast/IMPLEMENTATION_2026-08-26.md
```

---

## 8. Publication avec assignation audience

### Objectif

Lors de la publication d’une formation, l’admin choisit une cible : **tous**, **employés**, **postes** ou **départements**. La règle est stockée dans `course.metadata.audienceAssignment`. À la publication, les employés correspondants sont inscrits ; les nouveaux employés correspondants sont inscrits automatiquement (création, import CSV, acceptation d’invite).

### Backend

- Validation : `ZCourseAudienceAssignment` dans `packages/utils/src/validation/course/course.ts`
- Queries : `getOrganizationAudienceFilterOptions`, `getOrganizationMembersForAudienceAssignment`, `getPublishedCoursesWithAudienceAssignment`
- Service : `apps/api/src/services/course/audience-assignment.ts`
- Hook `PUT /course/:courseId` — sync à la publication ou changement de règle
- `GET /organization/audience/assignment-options` — listes distinctes postes/départements
- Sync continue : `createAudienceMember`, `importAudienceMembers`, `acceptOrganizationInvite`

### Frontend

- Composant `publish-audience-assignment.svelte` dans la section Publication des paramètres formation
- Store `audienceAssignment` dans `settings-store.ts`
