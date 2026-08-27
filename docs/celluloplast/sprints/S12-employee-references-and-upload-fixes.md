# S12 — Référentiels employés + correctifs upload / header

> **Statut** : livré · Prérequis S09 (audience) + champs RH `0007`  
> Objectif : postes/départements contrôlés (FK), CSV strict, uploads image fiables, masquer « Académie ouverte ».

---

# Goal

Remplacer les libellés texte libres `job_title` / `department` par des référentiels org-scoped (`organization_position`, `organization_department`), brancher création/import/assignation, corriger les 500 upload profil/org, et masquer le CTA catalogue public en V1.

---

# Décisions V1

| Sujet | Choix |
|-------|--------|
| Tables | `organization_position`, `organization_department` |
| Membres | `position_id`, `department_id` (FK `ON DELETE RESTRICT`) ; colonnes texte supprimées après backfill |
| CSV inconnu | **rejeter la ligne** + warning (pas d’auto-création) |
| Suppression référentiel | **refus** si ≥1 employé rattaché |
| CRUD | `orgAdminMiddleware` uniquement (`GET` accessible team member) |
| Assignation cours | modes `jobTitles` / `departments` restent **par nom** ; match via jointure référentiel |
| Édition employé | dropdowns à la **création** + CSV seulement |

---

# Migration

`0008_organization_hr_references` :

1. Crée les tables référentiel + unicité `(organization_id, lower(trim(name)))`
2. Ajoute `position_id` / `department_id` sur `organizationmember`
3. Backfill depuis les anciennes valeurs texte distinctes
4. Drop `job_title` / `department`

```powershell
docker exec celluloplast-api sh -c "cd /app/packages/db && pnpm db:migrate"
```

---

# Backend

| Couche | Détail |
|--------|--------|
| Zod | `position.ts`, `department.ts` ; `ZCreateAudienceMember` accepte `positionId` / `departmentId` (ou noms CSV) |
| Queries | CRUD + `countMembersUsing*` ; list audience jointure ; filter options depuis référentiels |
| Services | 409 si delete used / name duplicate ; import résout noms → IDs |
| Routes | `GET/POST/PUT/DELETE /organization/positions` et `/departments` |

---

# Frontend

- Nav Administration : `/settings/positions`, `/settings/departments`
- Pages CRUD (nom, N employés, rename, delete guard)
- Dialog création employé : `Select` branchés sur les référentiels
- Template CSV : `email,firstName,lastName,jobTitle,department,managerEmail`
- Header : `VisitOrgSiteBtn` seulement si `CELLULOPLAST_V1.exploreCatalog`

---

# Uploads

Flow : `POST /media/image` → MinIO (`OBJECT_STORAGE_*` dans compose Celluloplast).

Correctifs :

- Logging détaillé `PutObject` (bucket / key / erreur)
- Messages d’erreur upload renvoyés au client (plus de fallback générique opaque)
- Content-Type déduit de l’extension si le navigateur envoie un type vide
- Profil : persist `avatarUrl` via API **avant** Better Auth `updateUser` (best-effort)

Prérequis local : MinIO up + `OBJECT_STORAGE_MEDIA_PUBLIC_BASE_URL=http://localhost:9000/media`.

---

# Limitations V1

- Pas d’édition HR dédiée hors création / CSV
- Pas d’auto-création de postes/départements depuis CSV
- Renommer un poste ne réécrit pas l’historique `audienceAssignment` stocké en noms (match live par nom actuel)
- Pas de soft-delete des référentiels

---

# Recette rapide

```text
[ ] Migration 0008 appliquée
[ ] Administration → Postes : créer / renommer / delete bloqué si utilisé
[ ] Administration → Départements : idem
[ ] Ajouter employé : dropdowns (pas d’inputs libres)
[ ] CSV avec poste inconnu → ligne rejetée + warning
[ ] Publier formation ciblée par poste/département → inscription OK
[ ] Upload logo org + photo profil → succès (MinIO)
[ ] Bouton « Académie ouverte » absent du header
```
