# Celluloplast Academy — Audit de nettoyage (fork ClassroomIO)

> Sprint « nettoyage profond » — 2026-08-31
> Code : `_upstream_classroomio/` · Couche fork : `apps/dashboard/src/lib/celluloplast/`
>
> Règle appliquée : **preuve d'absence de référence avant toute suppression**.
> Ce que la recherche globale ne peut pas prouver mort reste `HIDE` ou `INVESTIGATE`.

---

## 0. Méthode

Chaque candidat a été passé au crible de :

| Vecteur vérifié | Commande / source |
|---|---|
| Imports statiques `.ts` / `.svelte` | `grep -rn` sur `apps/` + `packages/` hors `node_modules` |
| Imports dynamiques (`import(`, `await import`) | idem |
| Routes SvelteKit | arborescence `apps/dashboard/src/routes` |
| Appels RPC Hono | `grep -o "classroomio.<router>"` |
| Queues BullMQ | `packages/jobs/src/queues/names.ts` + workers `apps/jobs/src` |
| Cron / jobs internes | `apps/api/src/routes/internal/*` |
| Navigation / breadcrumbs / Ctrl+K | `org-navigation.ts`, `lms-navigation.ts`, `breadcrumb-configs.ts`, `features/search` |
| Feature flags | `lib/celluloplast/features.ts` |
| Variables d'env | `.env.example` vs `process.env` / `$env/static` |
| Assets statiques | balayage `static/**` vs références `src/**` |
| Dépendances npm | chaque clé de `package.json` regrepée dans les sources |

**Fait structurant** : `docker-compose.celluloplast.yaml` ne construit que `api`, `dashboard`, `jobs`.
Tout `apps/*` ou `packages/*` hors du graphe de dépendances de ces trois cibles est mort au sens
« produit Celluloplast », même s'il compile.

---

## 1. Cartographie par verdict

### 1.1 KEEP — cœur métier Celluloplast

| Domaine | Éléments |
|---|---|
| **Routes ADMIN/TUTOR** | `/org/[slug]/dash`, `/courses`, `/audience` (+ `import`, `[...params]`), `/progress`, `/certifications`, `/settings` (profil, notifications, org, teams, customize-lms, positions, departments, certificates) |
| **Routes formation** | `/courses/[id]/lessons` (+ `[lessonId]`), `/exercises` (+ `[exerciseId]`), `/people` (+ `[personId]`), `/settings`, `/certificates`, `/submissions`, `/marks` |
| **Routes STUDENT** | `/lms`, `/lms/mylearning`, `/lms/certificates`, `/lms/settings`, `/lms/settings/notifications` |
| **Auth** | `(auth)/login`, `logout`, `signup`, `forgot`, `reset`, `onboarding`, `auth-failed`, `verify-email-error`, `invite/[hash]`, `invite/link/[hash]` |
| **Composants fork** | `lib/celluloplast/*`, `features/learning-overview`, `features/certifications`, `features/certificate-designer` |
| **Services API** | `account`, `course`, `organization`, `dash`, `invite`, `onboarding`, `mail`, `media`, `hls`, `transcripts`, `jobs`, `internal`, `license` |
| **DB** | schéma complet — aucune migration destructive dans ce sprint |
| **Jobs worker** | queues `media`, `media-transcribe`, `emails`, `notifications`, `maintenance` |
| **Packages** | `@cio/db`, `@cio/utils`, `@cio/core`, `@cio/ui`, `@cio/email`, `@cio/certificates`, `@cio/question-types`, `@cio/jobs`, `@cio/analytics`, `@cio/tsconfig` |
| **Docker** | `postgres`, `redis`, `minio`, `minio-init`, `mailhog`, `api`, `dashboard`, `jobs` — aucun service hérité inutile |
| **Env** | `POSTGRES_*`, `BETTER_AUTH_SECRET`, `PRIVATE_SERVER_KEY`, `PRIVATE_SERVER_URL`, `PUBLIC_SERVER_URL`, `DASHBOARD_ORIGIN`, `PUBLIC_IS_SELFHOSTED`, `TRUSTED_ORIGINS`, `CSP_*`, `SMTP_*`, `MINIO_*`, `OBJECT_STORAGE_*`, `PRIVATE_APP_HOST/SUBDOMAINS`, `UPLOAD_MAX_*`, `BODY_SIZE_LIMIT`, `OPENAI_API_KEY` (**transcription uniquement**) |

### 1.2 REMOVE — mort prouvé

| Domaine | Élément | Preuve |
|---|---|---|
| Apps | `apps/website`, `apps/docs`, `apps/embeds`, `apps/course-app`, `apps/tenant-router` | aucun `@cio/{website,docs,embeds,course-app,tenant-router}` dans le graphe de dépendances de `api` / `dashboard` / `jobs` ; absents de `docker-compose` |
| Packages | `packages/storybook`, `packages/mcp`, `packages/course-app` | non listés dans les `dependencies` de `apps/api`, `apps/dashboard`, `apps/jobs` |
| IA — dashboard | `features/ai-assistant`, `features/agent`, `features/ai-tutor-settings`, `lib/components/AI`, routes `courses/[id]/ai-tutor`, `settings/ai-tutor`, `settings/ai-credits`, créateur IA de `org/[slug]/+page.svelte` | après réécriture des 15 importeurs, seul le code IA se référence lui-même ; le créateur IA n'était jamais rendu (§ 2.1) |
| IA — backend | `apps/api/routes/agent`, `apps/api/services/agent`, `routes/course/ai-tutor.ts`, `routes/organization/ai-tutor.ts`, `packages/core/services/agent`, `packages/ai-assistant`, worker + queue `agent-course-generation` | consommateurs exclusifs : le routeur `/agent`, les deux routes ai-tutor, le worker supprimé, et des tests supprimés avec eux |
| Fuites SaaS tierces | `lib/utils/services/userjot`, `posthog`, `umami` | UserJot chargeait `cdn.userjot.com` et **identifiait l'utilisateur par e-mail** même en self-host ; PostHog / Umami déjà court-circuités par `PUBLIC_IS_SELFHOSTED` |
| Billing | `settings/billing`, `routes/api/polar/**`, `features/settings/pages/billing.svelte`, `upgrade-modal`, `upgrade-banner`, `upgrade-trigger`, `powered-by` | `isOrgOnFreePlan({isSelfHosted:true})` renvoie toujours `false` → toutes les gardes sont inertes en self-host |
| Public academy | `routes/(org-site)/**`, `settings/landingpage(/edit)`, `features/ui/course-landing-page`, `features/settings/pages/landingpage*`, `courses/[id]/landingpage`, `visit-org-site-btn` | `CELLULOPLAST_V1.exploreCatalog = false` ; plus aucun lien entrant après nettoyage nav / header |
| Social | `(app)/cohorts/**`, `org/[slug]/cohorts`, `org/[slug]/community`, `lms/community`, `lms/cohorts`, `features/cohort`, `features/community` | absents des allowlists nav ; seuls référents = eux-mêmes + Ctrl+K (corrigé) |
| Automation | `org/[slug]/mcp`, `/api`, `/zapier`, `org/[slug]/widgets`, `(app)/widgets/**`, `widget-preview`, `features/automation`, `features/widget`, `settings/integrations`, `lms/settings/integrations` | idem |
| Divers upstream | `org/[slug]/tags`, `/media`, `/analytics`, `/compliance`, `/setup`, `/teams-overview`, `/quiz/**`, `settings/domains`, `settings/workspaces`, `settings/auth/**`, `lms/explore`, `lms/exercises`, `courses/[id]/analytics`, `/attendance`, `/compliance` | non navigables, aucun lien entrant après nettoyage |
| Assets | fichiers `static/images/*` et `static/*` non référencés, dont `classroomio-opengraph-image*.png` et `static/zohoverify/` (vérification de domaine Zoho **de ClassroomIO**) | balayage automatique référence-par-fichier |
| Deps dashboard | `stripe`, `unsplash-js`, `d3-cloud`, `d3-sankey`, `openai-edge`, `html-to-image`, `js-yaml`, `hotkeys-js`, `jessy`, `all-object-keys`, `wait-on`, `body-parser`, `cookie-parser`, `sirv`, `@types/pluralize`, `posthog-js`, `@polar-sh/*`, `ai`, `@ai-sdk/svelte`, `@cio/ai-assistant`, `@better-auth/sso`, `@sveltejs/adapter-vercel`, `@sveltejs/adapter-cloudflare`, `@sveltejs/adapter-auto`, `wrangler` | 0 occurrence dans `apps/dashboard/src` + fichiers de config |
| Env | `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `UPLOAD_MAX_AGENT_DOCUMENT_MB`, `UPLOAD_MAX_LANDING_IMAGE_MB`, `UNSPLASH_API_KEY` | code correspondant supprimé dans ce sprint |

### 1.3 HIDE — techniquement vivant, jamais affiché

| Élément | Pourquoi on ne supprime pas |
|---|---|
| Routeurs API `community`, `cohort`, `widgets`, `tags`, `org-site`, `unsplash`, `domain` | tables DB toujours présentes ; `services/cohort/goal.ts` est appelé par `POST /internal/compliance/evaluate-cohort-goals`. Supprimer = refonte DB, hors périmètre. |
| `apps/api/routes/course/compliance.ts` + `services/course/compliance.ts` | `ensureComplianceEnrollmentRecordsForProfiles` est appelé par **l'assignation d'employés** (`services/organization/audience.ts`, `services/course/people.ts`, `services/course/invite.ts`) et par la soumission d'exercice. **Dépendance technique d'une fonction conservée.** |
| Types `COMPLIANCE`, `LIVE`, `PUBLIC` de `course.type` | des formations existantes peuvent les porter ; la création est déjà verrouillée sur `SELF_PACED` |
| Plans / `isFreePlan` dans `@cio/utils/plans` | consommé par `@cio/api` et le schéma d'org ; neutralisé en self-host |
| `courses/[id]/certificates/editor` | conservé comme **redirection legacy** vers le designer entreprise (anciens favoris / liens d'e-mails) |
| Locales non FR/EN (`da, de, es, hi, pl, pt, ru, vi`) | chargées dynamiquement par `sveltekit-i18n` ; aucun gain à supprimer, coût de rebase non nul |

### 1.4 INVESTIGATE — non tranché, **non supprimé**

| Élément | Doute |
|---|---|
| `courses/[id]/submissions` et `/marks` | liés aux exercices notés (fonctionnellement KEEP) mais peu utilisés par Celluloplast — décision produit, pas technique |
| Queues `webhooks` et `courseImports` | déclarées dans `QUEUE_NAMES` sans worker dans `apps/jobs` — probablement déjà mortes upstream |
| `packages/analytics` (Tinybird) | `trackAgentEvent` disparaît avec l'IA ; reste à confirmer qu'aucun autre émetteur ne subsiste |
| `features/analytics` (composants réutilisés hors page `/analytics`) | quelques primitives graphiques peuvent servir à `learning-overview` |

---

## 2. Points saillants trouvés pendant l'audit

### 2.1 Le créateur de cours IA n'était déjà plus atteignable

`org/[slug]/+page.server.ts` redirige `307 → /dash` dès que `slug !== '*'`, et `+layout.svelte`
affiche des squelettes **au lieu des enfants** quand `slug === '*'`. Le composant `+page.svelte`
(≈ 400 lignes d'UI IA) n'était donc rendu dans aucun cas.

### 2.2 UserJot exfiltrait l'identité des utilisateurs

`appSetup.ts` appelait `initUserJot()` **avant** la garde `PUBLIC_IS_SELFHOSTED`, dans les deux
chemins d'initialisation. `identifyUserJotUser({ id, email, fullname, avatarUrl })` était ensuite
appelé depuis `features/app/init.svelte.ts`. Un LMS RH interne envoyait donc les e-mails de ses
employés à `cdn.userjot.com` sous l'App ID de ClassroomIO.

### 2.3 Liens sortants ClassroomIO dans l'UI

`help@classroomio.com`, `classroomio.com/docs`, `classroomio.com/contact`, `classroomio.com`
(page « accès restreint »), `classroomio.com/blog/early-adopter`, `play.classroomio.com`,
`pgrest.classroomio.com` (assets du quiz live).

### 2.4 Ctrl+K exposait des surfaces masquées

`features/search` renvoyait des groupes `cohort`, `widget`, `tag` pointant vers des routes retirées
de la navigation.

### 2.5 Faux widgets dans le header

Le popover « Notifications » de `app-header.svelte` était codé en dur (« No Notifications » +
bouton « Refresh » sans handler).

### 2.6 Flags morts

`CELLULOPLAST_V1.billing`, `.community`, `.automation`, `.cohorts` n'étaient lus nulle part — la
politique de navigation faisait déjà le travail.

### 2.7 Transcription ≠ génération IA

`OPENAI_API_KEY` sert **deux** choses distinctes :

- `apps/jobs/src/services/transcription/openai.ts` → Whisper, alimente le panneau de transcription
  vidéo utilisé dans les leçons — **conservé** ;
- `packages/ai-assistant/providers` → génération de cours / tuteur IA — **supprimé**.

`GOOGLE_API_KEY` et `ANTHROPIC_API_KEY` ne servaient que le second usage → supprimés.

---

## 3. Suite

- Phase 2 — recherche de références : consignée entrée par entrée dans `DEAD_CODE_REPORT.md`
- Phase 3 — suppression / masquage par lots
- Phase 4 — vérification (build, lint, Docker, parcours ADMIN / TUTOR / STUDENT)
- Liens morts : `BROKEN_LINKS_AUDIT.md`
