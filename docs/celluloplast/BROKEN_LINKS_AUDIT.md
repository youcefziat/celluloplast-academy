# Celluloplast Academy — Audit des liens internes

> Sprint « nettoyage profond » — 2026-08-31
> Méthode : extraction de tous les `href=`, `goto(...)`, `resolve(...)` de `apps/dashboard/src`,
> puis confrontation à l'arborescence réelle de `src/routes` **après** suppression.

---

## 1. Liens réellement cassés (destination inexistante)

Ces liens pointaient vers une route absente ou une ancre supprimée **avant** ce sprint,
ou le sont devenus pendant celui-ci et ont été corrigés.

| Lien | Source | Destination | Statut | Correction |
|---|---|---|---|---|
| « Partager » (menu contextuel formation) | `features/course/components/course-context-menu-content.svelte` | `/courses/[id]/settings#share` | **Cassé avant ce sprint** — la section `#share` n'existe plus depuis la simplification S08 des réglages | Entrée de menu et handler `handleShareCourse` supprimés |
| « Voir plus » (Explorer d'autres formations) | `features/lms/pages/dashboard.svelte` | `/lms/explore` | Cassé après suppression de la route | Bloc « Explore » entièrement retiré du tableau de bord apprenant |
| `LMS_HOME` | `lib/utils/constants/routes.ts` | `/home` | Cassé après suppression | Constante retirée de `ROUTE` et de `ROUTES_TO_HIDE_NAV` |
| `COURSE_AI_TUTOR` | `lib/routing/routes.ts` | `/courses/[id]/ai-tutor` | Cassé après suppression | Entrée `ROUTE_NAME`, `ROUTE_PATHS` et `ROUTE_SECTIONS` retirées |
| Onglet « Domaines personnalisés » | `features/settings/components/org-settings-inline-tabs.svelte` | `/settings/domains` | Masqué par l'allowlist, cassé après suppression | Onglet retiré de la liste amont |
| Onglets SSO / Token auth | `routes/(app)/org/[slug]/settings/+layout.svelte` | `/settings/domains`, `/settings/auth/*` | idem | Conditions de layout nettoyées |
| Routes `/course/[slug]`, `/courses` publiques | `lib/utils/constants/routes.ts` (`PUBLIC_ROUTES`) | site public supprimé | Cassé après suppression | Motifs retirés de `PUBLIC_ROUTES` |
| Webhook Polar | `lib/utils/constants/routes.ts` (`PUBLIC_API_ROUTES`) | `/api/polar/webhook` | Cassé après suppression | Constante `PUBLIC_API_ROUTES` supprimée |

## 2. Liens valides mais hors périmètre (retirés)

Destination techniquement joignable, mais menant à une surface que Celluloplast n'utilise pas.

| Lien | Source | Destination | Statut | Correction |
|---|---|---|---|---|
| Résultats Ctrl+K « Parcours » | `features/search/api/search.svelte.ts` | `/cohorts/{id}/courses` | Surface masquée | Groupe `cohort` retiré des résultats et du type `SearchResultKind` |
| Résultats Ctrl+K « Widgets » | idem | `/widgets/{id}` | Surface masquée | Groupe `widget` retiré |
| Résultats Ctrl+K « Étiquettes » | idem | `{org}/tags` | Surface masquée | Groupe `tag` retiré |
| « Académie ouverte » (header) | `features/ui/navigation/app-header.svelte` | site public de l'org | Hors périmètre | Bouton et composant `visit-org-site-btn.svelte` supprimés |
| « Voir le site du cours » | `features/course/components/course-header.svelte` + menu contextuel | `/course/{slug}` | Hors périmètre | Bouton, handler et `view-course-site-unpublished-modal.svelte` supprimés |
| « Copier l'URL du cours » | menu contextuel + modale « Voir comme un apprenant » | URL publique du cours | Hors périmètre | Action et `copyPublicCoursePageUrl` supprimés |
| Onglet formation « Page d'atterrissage » | `features/course/components/sidebar/course-sidebar-navigation.svelte` | `/courses/[id]/landingpage` | Hors périmètre | Entrée de nav et route supprimées |
| Onglets formation Analytique / Présence / Conformité / Fil d'actualité / Tuteur IA | idem | routes correspondantes | Hors périmètre | Entrées de nav, icônes et routes supprimées |

## 3. Faux boutons (aucune destination)

| Élément | Source | Comportement | Correction |
|---|---|---|---|
| Popover « Notifications » du header | `features/ui/navigation/app-header.svelte` | Contenu figé « No Notifications » + bouton « Refresh » **sans handler** | Popover entièrement supprimé |
| Checklist d'installation (header) | `features/ui/navigation/app-setup.svelte` | Liste d'onboarding ClassroomIO, non pertinente pour un LMS interne | Composant supprimé, feature `setup` supprimée |

## 4. Liens sortants ClassroomIO (fork visible)

| Lien | Source | Correction |
|---|---|---|
| `help@classroomio.com` | menu du pied de barre latérale | Entrée « Besoin d'aide » supprimée |
| `https://classroomio.com/docs` | idem | Entrée « Documentation » supprimée |
| Widgets UserJot « Quoi de neuf » / « Retour d'expérience » | idem | Entrées supprimées, SDK supprimé (voir `CLEANUP_AUDIT.md` § 2.2) |
| `https://classroomio.com/contact` | `routes/+page.svelte` (état d'erreur) | Bouton « Contact Us » supprimé |
| `https://classroomio.com` | `features/ui/page-restricted.svelte` (« Go Home ») | Remplacé par un lien interne vers `/` + libellés traduits |
| `https://classroomio.com/blog/early-adopter` | `features/ui/upgrade-modal.svelte` | Modale de facturation supprimée |
| `play.classroomio.com`, `pgrest.classroomio.com` | quiz live org (`features/org/components/quiz`, `lib/utils/constants/quiz.ts`) | Fonctionnalité et constantes supprimées |
| `assets.cdn.clsrio.com` (image) | `features/course/components/view-as-student-modal.svelte` | Image distante supprimée, modale simplifiée |
| `cdn.userjot.com` (script + identité utilisateur) | `lib/utils/services/userjot` | Service supprimé |
| Widget Senja (`senja.io`) | `features/ui/senja-embed.svelte`, page d'inscription | Composant et appel supprimés |
| Vérification de domaine Zoho **de ClassroomIO** | `static/zohoverify/verifyforzoho.html` | Fichier supprimé |

## 5. Vérification finale

Après correction, un balayage de tous les `href` / `goto` / `resolve` de `apps/dashboard/src`
ne renvoie plus aucune cible hors de l'arborescence `src/routes` conservée :

```
/  ·  /login  /logout  /signup  /forgot  /reset  /onboarding
/auth-failed  /verify-email-error  /invite/[hash]  /invite/link/[hash]  /404
/org/[slug]/dash · /courses · /audience · /progress · /certifications
/org/[slug]/settings{,/notifications,/org,/teams,/customize-lms,/positions,/departments,/certificates}
/courses/[id]/{lessons,exercises,people,settings,certificates,submissions,marks}
/lms · /lms/mylearning · /lms/certificates · /lms/settings{,/notifications}
```

Deux redirections legacy sont conservées volontairement :

| Route | Comportement | Raison |
|---|---|---|
| `/org/[slug]` | `307 → /org/[slug]/dash` | Point d'entrée après login, logo, favoris |
| `/courses/[id]/certificates/editor` | redirection client → `{org}/settings/certificates` | Anciens favoris vers l'éditeur de certificat par formation |
