# Celluloplast Academy — Architecture

> **Statut** : analyse uniquement — **aucune modification de code**.  
> **Source analysée** : clone lecture de [classroomio/classroomio](https://github.com/classroomio/classroomio) (`main`).  
> **État du workspace** : le dépôt applicatif n’est pas encore initialisé à la racine ; un clone d’analyse se trouve dans `_upstream_classroomio/`.  
> **Règles upstream** : lire et respecter `AGENTS.md` avant toute modification future.

---

## 1. Vue d’ensemble ClassroomIO

ClassroomIO est un LMS open source (AGPL-3.0) orienté formation en entreprise. Monorepo **pnpm + Turbo**, déployable en **self-host Docker**.

### Stack

| Couche | Technologie |
|--------|-------------|
| Frontend LMS | SvelteKit 2 + Svelte 5 + Tailwind (`apps/dashboard`) |
| API | Hono (TypeScript) (`apps/api`) |
| ORM / DB | Drizzle + PostgreSQL (`packages/db`) |
| Auth | Better Auth (sessions, OAuth, SSO optionnel) |
| Jobs | BullMQ + Redis (`apps/jobs`) |
| Stockage | S3-compatible / MinIO |
| Certificats | `packages/certificates` (rendu templates) |
| UI partagée | `packages/ui` |
| Validation | Zod partagé (`packages/utils/src/validation`) |

### Apps du monorepo

| App | Rôle | Pertinence V1 Celluloplast |
|-----|------|----------------------------|
| `apps/dashboard` | Application LMS (admin / tutor / student) | **Cœur** |
| `apps/api` | API HTTP + auth + RPC | **Cœur** |
| `apps/jobs` | Worker emails / média / traitements | **Cœur** (requis) |
| `apps/website` | Marketing classroomio.com | Hors scope (ne pas déployer) |
| `apps/docs` | Documentation produit | Hors scope |
| `apps/embeds` | Widget catalogue embarquable | Hors scope V1 |
| `apps/tenant-router` | Domaines custom (cloud) | Hors scope V1 |
| `apps/course-app` | App cours associée | À évaluer ; non prioritaire V1 |

### Couches API (à respecter)

```
Dashboard (SvelteKit)
    │  client RPC Hono + proxy SSR (PRIVATE_SERVER_KEY)
    ▼
Routes (HTTP, Zod, auth)     apps/api/src/routes/
    ▼
Services (métier, transactions)  apps/api/src/services/
    ▼
Queries (Drizzle pur)        packages/db/src/queries/
```

Référence upstream : `ARCHITECHTURE.md`, `AGENTS.md`.

**Principes fork-friendly** :
- ne pas court-circuiter Routes → Services → Queries ;
- ne pas supprimer des modules upstream « pour simplifier » — préférer masquage / config ;
- garder la capacité de `git fetch upstream` + rebase/merge.

---

## 2. Déploiement self-host (cible VPS)

Mode activé par `PUBLIC_IS_SELFHOSTED=true`.

Services Docker typiques (`docker-compose.yaml` / `classroomio.sh`) :

1. **postgres** — données
2. **redis** — files BullMQ + sessions helpers
3. **minio** — fichiers / vidéos / médias
4. **api** — `:3081` (schéma DB au démarrage)
5. **dashboard** — `:3082`
6. **jobs** — **obligatoire** (emails, transcodage, etc.)

Docs : `docker/docs/SELF_HOST.md`.

Comportements self-host déjà utiles pour Celluloplast :

- **une seule organisation** (création d’une 2ᵉ org bloquée) ;
- plan `ENTERPRISE` / provider `selfhosted` à l’onboarding ;
- billing Polar non utilisé ;
- tracking cloud (PostHog/Umami) désactivé.

---

## 3. Cartographie des domaines (où est quoi)

### Authentification

| Élément | Emplacement |
|---------|-------------|
| Handler Better Auth `/api/auth/*` | `apps/api/src/app.ts` |
| Schéma / config auth | `packages/db/src/auth.ts` |
| Hook création profil | `packages/db/src/auth/hooks/create-profile.ts` |
| Middleware session | `apps/api/src/middlewares/auth.ts` |
| Garde signup (invite-only, self-host) | `apps/api/src/middlewares/signup-guard.ts` |
| UI login / signup / onboarding | `apps/dashboard/src/routes/(auth)/` |
| Feature auth dashboard | `apps/dashboard/src/lib/features/auth/` |

### Rôles

| Élément | Emplacement |
|---------|-------------|
| Constantes `ADMIN=1`, `TUTOR=2`, `STUDENT=3` | `packages/utils/src/constants/roles.ts` |
| Table `role` + `organizationmember.roleId` | `packages/db/src/schema.ts` |
| `orgRoles` injecté dans la session | `apps/api/src/app.ts` |
| Middlewares RBAC | `apps/api/src/middlewares/org-admin.ts`, `org-team-member.ts`, `org-member.ts`, `course-*-member.ts` |

| Rôle | Capacités natives (résumé) |
|------|----------------------------|
| **ADMIN** | Org entière : membres, settings, cours, compliance, API keys… |
| **TUTOR** | Créer/gérer cours, noter, actions « team » |
| **STUDENT** | Suivre cours, soumettre, consulter certificats LMS |

→ Aligné avec le besoin Celluloplast V1 **sans nouveau modèle de rôles**.

### Utilisateurs

| Élément | Emplacement |
|---------|-------------|
| Profils | queries `packages/db/src/queries/auth/`, routes `apps/api/src/routes/account/` |
| Audience / roster org | `apps/dashboard/src/lib/features/audience/`, routes org audience |
| People (cours) | `apps/api/src/routes/course/people.ts`, `apps/dashboard/src/lib/features/people/` |
| Invitations org | `apps/api/src/routes/invite/` |
| Invitations cours | `apps/api/src/routes/course/invite.ts` |
| Settings équipes | `apps/dashboard/src/lib/features/settings/pages/teams.svelte` |

### Organisations

| Élément | Emplacement |
|---------|-------------|
| Table `organization` | `packages/db/src/schema.ts` |
| CRUD / settings | `apps/api/src/routes/organization/` |
| Onboarding 1ʳᵉ org | `apps/api/src/services/onboarding.ts` |
| Switcher org (UI) | `apps/dashboard/.../org-sidebar/org-switcher.svelte` |
| Feature org | `apps/dashboard/src/lib/features/org/` |

En self-host : **une org = l’entreprise Celluloplast**. Pas de multi-tenant métier à construire.

### Cours / leçons / modules (modèle pédagogique)

| Concept ClassroomIO | Table / API | UI |
|---------------------|-------------|-----|
| **Course** | `course`, `apps/api/src/routes/course/course.ts` | `apps/dashboard/.../(app)/courses`, `features/course/` |
| **Section** (regroupement) | `course_section`, `routes/course/section.ts` | arbre contenu course sidebar |
| **Lesson** | `lesson`, `routes/course/lesson.ts` | éditeur / lecteur de leçon |
| **Exercise** | `exercise`, `routes/course/exercise.ts` | quiz / devoirs |
| **Enrollment** | group members + people/invite | People du cours |
| **Cohort / Program** | `cohort`, `programCourse`, … `routes/cohort/` | `(app)/cohorts` |

### Progression

| Élément | Emplacement |
|---------|-------------|
| Complétion leçon | `lesson_completion` |
| Progression vidéo | `lesson_video_progress` |
| Mode progression libre / séquentielle | `course.metadata.progressionMode` |
| Complétion / compliance | `course_completion_record`, `routes/course/compliance.ts` |
| Analytics | `apps/api/src/routes/dash`, `features/analytics/` |
| Vue apprenant | `features/lms/pages/mylearning.svelte`, `dashboard.svelte` |

### Certificats

| Élément | Emplacement |
|---------|-------------|
| Émission | `course_certificate_issue` |
| Rendu PDF/HTML templates | `packages/certificates/src/render.ts`, `templates/` |
| UI étudiant | `apps/dashboard/.../lms/certificates`, `features/lms/pages/certificates.svelte` |
| Config certificat cours | `course.metadata.certificate` |

### Dashboards

| Persona | Entrée principale |
|---------|-------------------|
| Admin / Tutor (workspace org) | `/org/[slug]/…` — sidebar org (`org-sidebar`, `org-navigation.ts`) |
| Student (LMS) | `/lms/…` — sidebar LMS (`lms-sidebar`, `lms-navigation.ts`) |
| Home org | `/org/[slug]` + `/org/[slug]/dash` |
| Home apprenant | `/lms`, `/lms/mylearning` |

### Paramètres

| Zone | Emplacement |
|------|-------------|
| Pages settings | `apps/dashboard/src/lib/features/settings/pages/` |
| Routes | `/org/[slug]/settings/*`, `/lms/settings/*` |
| Customize LMS (toggle community/exercises, bannières) | `customize-lms.svelte` |
| Org profile / thème couleur | `org.svelte` |
| Billing / AI credits / AI tutor / landing / domains | pages dédiées (à masquer V1) |

### Navigation / sidebar

| Sidebar | Fichier de config des liens |
|---------|-----------------------------|
| Org (admin/tutor) | `apps/dashboard/src/lib/features/ui/navigation/org-navigation.ts` |
| LMS (student) | `apps/dashboard/src/lib/features/ui/navigation/lms-navigation.ts` |
| Cours | `features/course/components/sidebar/` |
| Cohort | `features/cohort/components/sidebar/` |

Point d’extension **prioritaire** pour masquer les features hors scope sans les supprimer.

### Branding

| Élément | Emplacement |
|---------|-------------|
| Logo / avatar org, favicon, thème | colonnes `organization` + settings UI |
| Thème couleur org | `settings/pages/org.svelte` (`theme`) |
| Personnalisation LMS (banner, auth bg) | `customize-lms.svelte` |
| Landing publique org | `landingpage.svelte` + routes `(org-site)` |
| Logos UI ClassroomIO | `org-sidebar/app-logo.svelte`, assets dashboard |
| Certificats brandés | templates `packages/certificates` |

Pour Celluloplast Academy : rebranding UI + org theme + certificats ; **pas** besoin de réécrire le moteur LMS.

---

## 4. Mapping pédagogique Celluloplast ↔ ClassroomIO

Besoin métier :

```
Formation
  └─ Module
       ├─ Cours
       ├─ Cours
       ├─ Achievement
       └─ Certificat éventuel
(+ certification finale possible sur la Formation)
```

### Recommandation V1 (minimale, fork-friendly)

| Celluloplast | ClassroomIO | Commentaire |
|--------------|-------------|-------------|
| **Formation** | **Course** | Unité d’assignation, progression, certificat |
| **Module** | **Course section** (`course_section`) | Regroupement pédagogique |
| **Cours** | **Lesson** | Contenu consultable / complétable |
| **Achievement** | Complétion leçon + (optionnel) **Exercise** réussi | Pas d’entité « achievement » native gamifiée |
| **Certificat** | `courseCertificateIssue` + `packages/certificates` | Déjà branché sur la complétion |

**Alternative** (programmes multi-cours) : Formation = **Cohort**, Module = **Course**, Cours = **Lesson**. Plus riche, plus de surface UI. À réserver si une Formation doit réellement regrouper plusieurs courses indépendants.

**Décision proposée pour V1** : rester sur **Course → Section → Lesson**. Renommages UI (i18n) éventuels ; **pas de nouveau schéma**.

---

## 5. Architecture cible minimale Celluloplast Academy

```
┌─────────────────────────────────────────────────────────┐
│  VPS Docker (self-host)                                 │
│  postgres · redis · minio · api · dashboard · jobs      │
└─────────────────────────────────────────────────────────┘
         │
         │  Une org : "Celluloplast"
         │
┌────────┴────────┐     ┌──────────────────┐
│  Org workspace  │     │  LMS student     │
│  ADMIN / TUTOR  │     │  STUDENT         │
│  /org/...       │     │  /lms/...        │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
   Cours, people,          My learning,
   progression,            leçons, certificats
   certificats admin
```

### Ce qu’on conserve tel quel (cœur)

- Auth Better Auth + rôles ADMIN/TUTOR/STUDENT  
- Org unique self-host  
- Courses / sections / lessons / exercises (exercises optionnels)  
- Invites + enrollment  
- Progression + compliance légère si utile  
- Certificates  
- Media + jobs (pour vidéos/docs)  
- Audience / teams  

### Ce qu’on ne déploie / n’expose pas (surface réduite)

- `apps/website`, `apps/docs`, `apps/embeds` (sauf besoin futur)  
- MCP, public API, Zapier (sauf intégration RH ultérieure)  
- Agent IA, AI tutor, AI credits  
- Community, widgets, org-site marketing, custom domains  
- Billing Polar, plans payants, upgrade UI  
- Multi-org, partenaires, marketplace  

### Couche « Celluloplast » (fine)

Préférer une couche de **configuration / feature flags / navigation / i18n / branding** plutôt qu’un fork profond :

1. **Nav filters** — retirer liens hors scope dans `org-navigation.ts` / `lms-navigation.ts`  
2. **Defaults org** — community/exercises off via `customization`  
3. **Branding** — logos, thème, textes, certificats  
4. **Copy métier** — traductions FR « Formation / Module / Cours »  
5. **Docs internes** — ce dossier `docs/celluloplast/`  

Éviter de supprimer packages upstream : cela casse les merges futurs.

### Stratégie git recommandée

```
origin   → fork Celluloplast (privé)
upstream → https://github.com/classroomio/classroomio.git
```

- Changements Celluloplast isolés (fichiers de nav, assets, env, docs, éventuellement un petit module `apps/dashboard/src/lib/celluloplast/` de feature flags).  
- Rebases périodiques depuis `upstream/main`.  
- Ne pas reformater / renommer massivement le monorepo.

---

## 6. Correspondance besoins métier ↔ existant

| Besoin V1 | Couverture | Action |
|-----------|------------|--------|
| ADMIN gérer utilisateurs | Audience + teams + invites | **Réutiliser** ; UI FR / simplifier nav |
| ADMIN créer formations | Courses | **Réutiliser** (+ i18n « Formation ») |
| ADMIN modules/cours | Sections + Lessons | **Réutiliser** |
| ADMIN assigner | Course people / invites | **Réutiliser** |
| ADMIN progression | Dash / analytics / course people / compliance | **Réutiliser** ; simplifier vues |
| ADMIN certificats | Certificates + completion | **Réutiliser** |
| TUTOR créer/modifier formations | Rôle TUTOR + course team | **Réutiliser** ; clarifier périmètre |
| TUTOR progression apprenants | Course people / marks | **Réutiliser** |
| STUDENT voir formations | `/lms/mylearning` | **Réutiliser** |
| STUDENT consulter cours | Lesson player | **Réutiliser** |
| STUDENT terminer modules | `lesson_completion` / progression | **Réutiliser** |
| STUDENT progression | LMS dashboard | **Réutiliser** |
| STUDENT télécharger certificats | `/lms/certificates` | **Réutiliser** |

---

## 7. Prochaines étapes (après validation docs)

1. Valider `PRODUCT_SCOPE.md` et `ROADMAP.md`.  
2. Initialiser le fork à la racine du workspace (remotes `origin` / `upstream`).  
3. Copier / conserver `AGENTS.md` upstream comme référence obligatoire.  
4. Démarrer Sprint 0 (bootstrap Docker self-host) — voir `ROADMAP.md`.

**Aucun code applicatif ne doit être modifié avant validation explicite de ces documents.**
