# Celluloplast Academy — Rapport de code mort

> Sprint « nettoyage profond » — 2026-08-31 · complément de `CLEANUP_AUDIT.md`
> **1 506 fichiers supprimés**, dont 392 dans `apps/dashboard/src` (86 fichiers de routes).
> Bilan `git diff --stat` : 1 635 fichiers touchés, 685 insertions, 135 342 suppressions.

Chaque entrée indique la **preuve** qui a autorisé la suppression. Rien n'a été supprimé
sur la seule base de « ça n'apparaît pas dans l'interface ».

---

## 1. Applications et paquets entiers

| Supprimé | Raison | Preuve d'absence de référence | Impact |
|---|---|---|---|
| `apps/website` | Site marketing ClassroomIO | Aucun `@cio/website` dans les `dependencies` de `api` / `dashboard` / `jobs` ; absent de `docker-compose` | Aucun — jamais construit ni déployé |
| `apps/docs` | Documentation publique ClassroomIO | idem (`@cio/docs`) | Aucun |
| `apps/embeds` | Widgets embarquables pour sites clients | idem (`@cio/embeds`) ; le routeur API `/widgets` reste monté (HIDE) | Aucun |
| `apps/course-app` + `packages/course-app` | Application cours autonome (npm) | idem (`@classroomio/course-app`) | Aucun |
| `apps/tenant-router` | Worker Cloudflare de routage multi-tenant SaaS | idem ; Celluloplast est mono-hôte | Aucun |
| `packages/storybook` | Atelier de composants | Non listé dans les dépendances des 3 cibles Docker | Aucun |
| `packages/mcp` | Serveur MCP publié sur npm | idem ; l'UI `/mcp` est supprimée | Aucun |
| `packages/ai-assistant` | Prompts / providers / outils IA | Consommateurs uniques : `apps/api/routes/agent`, `apps/api/services/agent`, `packages/core/services/agent` — tous supprimés | **Aucune IA au runtime** |

**Dépendances retirées avec eux** : `@cio/ai-assistant` (api, core, dashboard), `ai`, `@ai-sdk/openai`, `@ai-sdk/svelte`, `openai-edge`.

---

## 2. IA — suppression complète

| Supprimé | Preuve |
|---|---|
| `apps/dashboard/src/lib/features/{ai-assistant,agent,ai-tutor-settings}` | 15 importeurs externes réécrits (voir § 2.1) ; plus aucune référence |
| `apps/dashboard/src/lib/components/AI` | Aucun importeur |
| Routes `courses/[id]/ai-tutor`, `settings/ai-tutor`, `settings/ai-credits` | Absentes de l'allowlist nav ; onglets et liens supprimés |
| Créateur de cours IA (`org/[slug]/+page.svelte`) | **Jamais rendu** : `+page.server.ts` redirige `307 → /dash`, et le layout affiche des squelettes au lieu des enfants pour le placeholder `*` |
| `apps/api/src/routes/agent`, `apps/api/src/services/agent` | Consommateurs : le routeur `/agent` (démonté), `routes/course/ai-tutor.ts` et `routes/organization/ai-tutor.ts` (supprimés), 4 tests (supprimés) |
| `packages/core/src/services/agent` | Seul export public : `runAgentCourseGenerationJob`, consommé uniquement par le worker supprimé |
| `packages/db/src/queries/agent` | Aucun consommateur restant ; **tables et colonnes conservées en base** (pas de migration destructive) |
| `packages/utils/src/agent-models`, `validation/agent` | Consommateurs : `packages/ui/custom/{course-creator,model-picker}` (supprimés) et le routeur agent |
| `packages/ui/src/custom/{course-creator,model-picker}` | Aucun importeur après la suppression du créateur IA |
| Worker + queue `agent-course-generation` | `apps/jobs/src/index.ts` mis à jour ; `QUEUE_NAMES`, `JOB_NAMES`, `QUEUE_DEFAULTS`, enqueue et payload retirés |
| Env `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `UPLOAD_MAX_AGENT_DOCUMENT_MB` | Lus uniquement par `packages/ai-assistant/providers` et les uploads de l'agent |

### 2.1 Ce qui a été **conservé**, et pourquoi

| Conservé | Raison |
|---|---|
| `OPENAI_API_KEY` | Sert **uniquement** `apps/jobs/src/services/transcription/openai.ts` (Whisper). La transcription vidéo alimente le panneau latéral de transcription utilisé dans les leçons. Non renseignée ⇒ les jobs `transcribe-audio` se terminent proprement en `skipped`. |
| `getStudentContentLockReason` / `isCourseContentLockedForStudent` | Logique de **verrouillage de contenu apprenant**, hébergée par erreur dans `features/ai-assistant/utils/content-ask-ai-bar.ts`. Déplacée vers `features/course/utils/content-lock-utils.ts`, 6 importeurs mis à jour. |
| Queue `media-transcribe` | Voir ci-dessus. |

---

## 3. Fuites vers des services tiers

| Supprimé | Preuve / gravité |
|---|---|
| `lib/utils/services/userjot` | `appSetup.ts` appelait `initUserJot()` **avant** la garde `PUBLIC_IS_SELFHOSTED`, et `init.svelte.ts` envoyait `{id, email, fullname, avatarUrl}` à `cdn.userjot.com` sous l'App ID de ClassroomIO. Fuite d'identité d'employés depuis un LMS RH interne. |
| `lib/utils/services/posthog` + dép. `posthog-js` | 8 sites d'appel réécrits ; déjà court-circuité en self-host, mais le SDK restait chargé |
| `lib/utils/services/umami` | idem |
| `features/ui/senja-embed.svelte` | Widget de témoignages `senja.io` sur la page d'inscription, avec l'ID d'embed ClassroomIO |
| `static/zohoverify/verifyforzoho.html` | Fichier de vérification de domaine Zoho **appartenant à ClassroomIO** |
| Liste `saasDefaults` de `lib/utils/csp-domains.js` | Autorisait `cdn.userjot.com`, `*.posthog.com`, `*.senja.io`, `umami.hz.oncws.com`, `*.classroomio.com`, `pgrest.classroomio.com`, `play.classroomio.com`. Inatteignable en self-host, mais supprimée pour de bon. |

**Sentry est conservé** : auto-hébergeable et inerte sans `PUBLIC_SENTRY_DSN`.

---

## 4. Facturation / SaaS

| Supprimé | Preuve |
|---|---|
| `routes/api/polar/**` (webhook, checkout, portail, achat de jetons) | `isOrgOnFreePlan({ isSelfHosted: true })` retourne **toujours** `false` ⇒ aucune garde de plan ne se déclenche en self-host |
| `settings/billing`, `settings/ai-credits` + pages et API associées | idem |
| `features/ui/{upgrade-modal,upgrade-banner}.svelte`, `sidebar/org-sidebar/upgrade-trigger.svelte`, `lib/utils/store/upgrade-modal.ts` | 14 sites `<UpgradeBanner>` retirés ; 3 appels `openUpgradeModal()` retirés |
| `features/ui/powered-by.svelte` | Attribution « Powered by » dans la barre latérale du cours |
| `features/course/utils/exercise-draft.ts` | Servait **uniquement** à sauvegarder l'éditeur avant la redirection vers le paiement Polar ; sans écrivain, `restoreExerciseDraft` ne pouvait plus rien restaurer |
| Gate « type de question premium » (`question-type-select.svelte`) | Tous les types sont disponibles en self-host |
| Dépendances `@polar-sh/sdk`, `@polar-sh/sveltekit`, `stripe` | 0 occurrence dans `apps/dashboard/src` |

**Conservé (HIDE)** : `@cio/utils/plans` et le dérivé `isFreePlan`. Il reste consommé par le
schéma d'organisation et par `@cio/api` ; les quelques `disabled={$isFreePlan}` restants sont
inertes (toujours `false`) et leur retrait mécanique n'apporterait rien.

---

## 5. Académie publique / site public

| Supprimé | Preuve |
|---|---|
| `routes/(org-site)/**` (site public, page cours, inscription, leçon publique) | Celluloplast est mono-hôte et interne ; `CELLULOPLAST_V1.exploreCatalog = false` ; plus aucun lien entrant après le nettoyage nav / header |
| `routes/(app)/home`, `settings/landingpage(/edit)`, `courses/[id]/landingpage` | idem |
| `features/ui/course-landing-page/**`, `features/settings/pages/landingpage*`, `features/org/{components/landing-page,utils/landing-page*}` | idem |
| `features/ui/visit-org-site-btn.svelte` | Bouton « Académie ouverte » retiré du header et des pages Réglages / Accueil admin |
| `course-preview.ts` : `getPublicCoursePageUrl`, `openCoursePreview`, `copyPublicCoursePageUrl` | Cibles = pages publiques supprimées. **`viewAsStudent` est conservé** : le handoff par login-link fonctionne en self-host et reste utile aux tuteurs. |
| `lib/celluloplast/landing-page.ts` | N'existait que pour filtrer les liens du catalogue public dans les réglages de landing page |
| Onglet Unsplash de `upload-widget.svelte` + `upload-widget/utils.ts` + env `UNSPLASH_API_KEY` | Recherche d'images externe, hors périmètre d'un LMS interne |

`routes/+page.svelte` a été réécrit : `/` n'est plus qu'un point d'entrée (spinner + `setupApp`),
`landing.server.ts` se charge de la redirection vers le foyer du rôle.

---

## 6. Social, automation, divers upstream

| Domaine | Fichiers supprimés | Preuve |
|---|---|---|
| Cohortes | `routes/(app)/cohorts/**`, `org/[slug]/cohorts`, `lms/cohorts`, `features/cohort` | Absents de l'allowlist nav ; seuls référents = eux-mêmes + Ctrl+K (corrigé) |
| Communauté | `org/[slug]/community/**`, `lms/community/**`, `features/community` | idem ; `lms-breadcrumbs.svelte` découplé de `currentCommunityQuestion` |
| Fil d'actualité | `courses/[id]` (page = fil), `features/course/{pages/newsfeed.svelte,components/newsfeed,api/newsfeed}` | `/courses/[id]` redirige désormais `307 → /lessons` |
| Widgets | `routes/(app)/widgets/**`, `widget-preview`, `org/[slug]/widgets`, `features/widget` | idem |
| Automation | `org/[slug]/{mcp,api,zapier,automation}`, `features/automation`, `settings/integrations`, `lms/settings/integrations` | idem |
| Étiquettes | `org/[slug]/tags`, `features/tag`, `course-tag-picker.svelte`, filtre par étiquette | **Sans page d'administration, aucune étiquette ne peut plus être créée** ⇒ filtre et affichage vides par construction |
| Quiz live (Kahoot) | `org/[slug]/quiz/**`, `features/org/components/quiz`, `lib/utils/constants/quiz.ts`, stores `quizStore`/`playQuizStore` | Fonctionnalité distincte des exercices de formation (conservés) ; chargeait des assets depuis `pgrest.classroomio.com` |
| Analytique / conformité / présence | `org/[slug]/{analytics,compliance}`, `courses/[id]/{analytics,attendance,compliance}`, `features/analytics`, `features/compliance`, `course/pages/{analytics,attendance,compliance}.svelte` | Onglets retirés de la nav du cours ; `features/analytics` n'alimentait que la page analytique du cours |
| Installation | `org/[slug]/setup`, `features/setup`, `navigation/app-setup.svelte` | Checklist d'onboarding ClassroomIO, sans valeur pour un LMS interne |
| Multi-org / SaaS | `settings/{domains,workspaces,auth/**}`, `features/org/components/add-org-modal`, `features/org/api/{org-plan*,quiz}` | Celluloplast est mono-tenant |
| LMS apprenant | `lms/{explore,exercises}`, `features/lms/pages/{explore,exercises}.svelte`, `components/{course-preview-modal,upcoming-sessions-card,learning}.svelte` | Routes supprimées ; la modale de prévisualisation n'était atteignable que depuis le bloc « Explorer » |
| API courses recommandés | `coursesApi.getRecommendedCourses` + état associé | Seul appelant = le bloc « Explorer » du tableau de bord apprenant |

---

## 7. Composants orphelins (jamais importés)

Balayage programmatique : pour chaque `*.svelte` hors fichiers de route, recherche du nom de
fichier **et** du nom PascalCase dans tous les autres fichiers de `apps/dashboard/src`.

| Fichier | Note |
|---|---|
| `features/course/components/ceritficate/reports.svelte` | Orphelin upstream |
| `features/course/components/certificate-deadline-required-dialog.svelte` | Orphelin upstream |
| `features/course/components/exercise/grading-loader.svelte` | Orphelin upstream |
| `features/course/components/lesson/video/transcript-panel.svelte` | Remplacé par `transcript-side-panel.svelte` (seul référencé par la définition de panneau) |
| `features/course/components/people/{invite-list-section,invite-settings-section}.svelte` | Orphelins upstream |
| `features/course/components/reorder-material-tabs.svelte` | Orphelin upstream |
| `features/course/components/sidebar/course-content-sidebar-navigation.svelte` | Orphelin upstream |
| `features/course/components/people/share-qr-image.svelte` | Carte QR pour l'URL publique du cours ; aucun importeur |
| `features/org/components/image-renderer.svelte` | Orphelin upstream |
| `features/ui/{code-snippet,vote,attention-highlight,backdrop}.svelte` | 0 référence hors `index.ts` |
| `features/ui/sidebar/org-sidebar/org-switcher.svelte` | `isSingleOrgMode` était **toujours vrai** (`PUBLIC_IS_SELFHOSTED === 'true' \|\| !multiOrganization`) et seule la variante `breadcrumb` était rendue ⇒ toute l'UI de bascule était inatteignable. Remplacé par `navigation/current-org-crumb.svelte` (lien vers l'accueil org), sans mention de plan tarifaire. |

### 7.1 Modules orphelins (`.ts`)

Même méthode, appliquée aux modules : `mockData.ts`, `course-container.ts`, `people/invite-utils.ts`,
`sidebar/sidebar-history.ts`, `utils/newsfeed-comment-utils.ts`, `utils/public-course-mappers.ts`,
`utils/publish-course.ts`, `utils/submissions-utils.ts`, `lms/api/exercises.server.ts`,
`org/api/token-auth.svelte.ts`, `org/store/sso.svelte.ts`, `constants/reusableClass.ts`,
`functions/{genUniqueId,generateUUID,showAppsSideBar}.ts`, `functions/routes/hideNavByRoute.ts`,
`services/api/parse-api-error-body.ts`, `store/useMobile.ts`, `types/polar.ts`,
`navigation/breadcrumb-configs.ts`.

Clients d'API dont la page a disparu ou qui ont été remplacés par un `+page.server.ts` :
`course/api/{attendance,compliance,mark}.svelte.ts`.

`features/account` est réduit à `createViewAsStudentToken` : la gestion d'espaces de travail
(multi-org) et `loadUsage` n'avaient plus de page.

---

## 8. i18n

14 espaces de noms de premier niveau supprimés dans **les 10 fichiers de locale** :

```
aiTutor · ai · ai_assistant · automation · cohorts · public_course · public_courses
pricing · setup · add_org · markdown_editor · my_learning · profileMenu · tags_admin
```

**Preuve** : recherche de `'<ns>.` / `"<ns>.` / `` `<ns>. `` dans tout `apps/dashboard/src`
(hors `translations/`), y compris à l'intérieur des littéraux de gabarit qui construisent des
clés dynamiques. Zéro occurrence. Résultat : 2,3 Mo de traductions au lieu de ~2,9 Mo.

Trois clés ont été **ajoutées** (états d'erreur qui affichaient de l'anglais en dur) :
`app.setup_error.{title,description,reload}`, `app.restricted.{title,description}`, `common.reset`.

---

## 9. Assets statiques

66 fichiers supprimés + le dossier `zohoverify/`. **Preuve** : pour chaque fichier de
`static/**`, recherche de son nom dans `apps/dashboard/src`, `static/manifest.json` et
`packages/ui/src`. Les fichiers servis directement par l'hôte (`robots.txt`, `favicon.ico`,
`manifest.json`, `theme-init.js`) sont exclus du balayage.

`static/` passe de **21 Mo à 5,8 Mo** (les 3 icônes PNG référencées par `manifest.json` et
`brand.ts` sont conservées).

---

## 10. Dépendances npm supprimées

**`apps/dashboard`** — 26 entrées :

```
@cio/ai-assistant  ai  @ai-sdk/svelte  openai-edge        (IA)
@polar-sh/sdk  @polar-sh/sveltekit  stripe                (facturation)
posthog-js                                                (analytics SaaS)
unsplash-js  d3-cloud  d3-sankey  html-to-image  js-yaml  hotkeys-js
wait-on  body-parser  cookie-parser  sirv  @types/pluralize
@sveltejs/adapter-auto  @sveltejs/adapter-vercel
@sveltejs/adapter-cloudflare  wrangler                    (déploiement cloud)
jessy  all-object-keys
```

**`apps/api`** : `@cio/ai-assistant`, `ai`
**`packages/core`** : `@cio/ai-assistant`, `ai`, `@ai-sdk/openai`

**Preuve** : chaque nom regrepé dans `src/**` et dans les fichiers de configuration
(`svelte.config.js`, `vite.config.*`, scripts). Zéro occurrence.

> **`@better-auth/sso` a été retiré puis restauré.** Le premier balayage n'avait relevé qu'une
> occurrence, prise à tort pour une mention de configuration : `lib/utils/services/auth/client.ts`
> enregistre en réalité le plugin `ssoClient()`, et la page de connexion appelle
> `authClient.signIn.sso(...)`. Le serveur (`packages/db/src/auth.ts`) enregistre le plugin
> correspondant. Le SSO est donc classé **HIDE** : l'UI de configuration est supprimée, le
> chemin d'authentification reste intact.
`packages/core/tsconfig.json` a perdu sa référence de projet vers `../ai-assistant`.
`pnpm-lock.yaml` régénéré (`pnpm install`).

---

## 11. Variables d'environnement supprimées

| Variable | Raison |
|---|---|
| `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY` | Providers IA supprimés |
| `UNSPLASH_API_KEY` | Recherche d'images supprimée de l'UI (le routeur API reste monté, HIDE) |
| `LICENSE_KEY` | Ne débloquait que SSO / token-auth / no-tracking — toutes supprimées |
| `UPLOAD_MAX_AGENT_DOCUMENT_MB`, `UPLOAD_MAX_LANDING_IMAGE_MB` | Uploads de l'agent IA et de la landing page |
| `AGENT_COURSE_GENERATION_WORKER_CONCURRENCY` | Worker supprimé |

`OPENAI_API_KEY` est **conservée** et documentée dans `.env.example` comme « transcription
Whisper uniquement ».

---

## 12. Code mort restant (assumé)

| Élément | Pourquoi il reste |
|---|---|
| Routeurs API `community`, `cohort`, `widgets`, `tags`, `org-site`, `unsplash`, `domain` | Tables DB présentes ; `services/cohort/goal.ts` est appelé par `POST /internal/compliance/evaluate-cohort-goals` |
| `routes/course/compliance.ts` + `services/course/compliance.ts` | `ensureComplianceEnrollmentRecordsForProfiles` est appelé par **l'assignation d'employés** et par la soumission d'exercice |
| Types RPC `newsfeed`, `attendance` dans `features/course/utils/types.ts` | Types dérivés du client Hono ; effacés à la compilation |
| Champs `licenseFeatures` / `plans` de la réponse `/account` | Retirer ces champs modifierait le contrat de l'API |
| Queues `webhooks` et `courseImports` | Déclarées sans worker — déjà mortes en amont, hors périmètre |
| Locales autres que FR / EN | Chargées dynamiquement, sans coût |
| `static/images/classroomio-course-img-template.jpg` | Encore utilisé comme aperçu par défaut du fond d'écran d'authentification (renommage cosmétique non fait) |
