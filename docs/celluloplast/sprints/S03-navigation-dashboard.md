# S03 — Navigation & dashboards par rôle

> **Statut** : livré · **Périmètre** : structure de navigation et dashboards uniquement
> **Principe appliqué** : `masquer > configurer > modifier > supprimer` (cf. `PRODUCT_SCOPE.md` §5)

---

## 1. Objectif

Ramener l'interface ClassroomIO aux trois parcours Celluloplast :

| ADMIN          | TUTOR          | STUDENT         |
| -------------- | -------------- | --------------- |
| Accueil        | Accueil        | Accueil         |
| Formations     | Mes formations | Mes formations  |
| Employés       | Apprenants     | Mes certificats |
| Progression    | Certifications |                 |
| Certifications |                |                 |
| Administration |                |                 |

Aucune route ni fonction backend n'a été supprimée. Aucun changement de schéma. La logique des cours et des certificats n'a pas été touchée.

---

## 2. Analyse préalable

### 2.1 Navigation existante

Un seul point d'entrée par surface, consommé par **trois** UI :

| Fichier                                                                    | Rôle                          |
| -------------------------------------------------------------------------- | ----------------------------- |
| `features/ui/navigation/org-navigation.ts` → `baseNavConfig`               | Espace org (admin/tuteur)     |
| `features/ui/navigation/lms-navigation.ts` → `baseNavConfig`               | Espace apprenant              |
| `features/search/utils/static-catalog.ts`                                  | Palette de commandes (Ctrl+K) |
| `features/ui/navigation/app-breadcrumbs.svelte` / `lms-breadcrumbs.svelte` | Fil d'Ariane                  |
| `features/ui/sidebar/{org,lms}-sidebar/nav-main.svelte`                    | Barre latérale                |

**Conséquence exploitée** : filtrer `baseNavConfig` à la source masque l'entrée dans la sidebar **et** dans le fil d'Ariane **et** dans la recherche, sans toucher aux trois composants.

### 2.2 Contrôles de rôles existants (réutilisés tels quels)

| Élément                                             | Emplacement                             |
| --------------------------------------------------- | --------------------------------------- |
| `ROLE = { ADMIN: 1, TUTOR: 2, STUDENT: 3 }`         | `packages/utils/src/constants/roles.ts` |
| `isOrgAdmin`, `isOrgTeamMember`, `isOrgManagerRole` | `lib/utils/store/org.ts`                |
| `isOrgStudent`, `isStudentExperience`, `basePath`   | `lib/utils/store/app.ts`                |
| Champ `requiresAdmin` sur chaque entrée de nav      | `org-navigation.ts`                     |

**Aucun nouveau système de rôles n'a été introduit.** La distinction ADMIN/TUTOR de ce sprint passe exclusivement par le `requiresAdmin` déjà présent.

### 2.3 Dashboards par rôle

| Route                    | Contenu                                                                                                            | Décision                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `/org/{slug}`            | Créateur de cours **par IA**                                                                                       | **Masqué** (IA hors V1) → redirection vers `/dash` |
| `/org/{slug}/dash`       | Certificats délivrés, nb de formations, apprenants, top formations, certifications récentes, activité de connexion | **Devient « Accueil »** admin/tuteur               |
| `/org/{slug}/compliance` | Suivi apprenant × formation (statuts, échéances)                                                                   | **Devient « Progression »** (ADMIN)                |
| `/org/{slug}/analytics`  | Funnel marketing, pays, landing KPIs                                                                               | **Masqué** (commercial)                            |
| `/lms`                   | Progression, conformité, série, formations en cours, **suggestions catalogue**                                     | Conservé, section catalogue masquée                |

---

## 3. Architecture retenue : une couche fork isolée

Deux fichiers concentrent toute la politique V1, pour que les fichiers upstream ne portent qu'un appel :

```
apps/dashboard/src/lib/celluloplast/
├── brand.ts        (S02 — identité visuelle)
├── features.ts     (NOUVEAU — drapeaux de périmètre V1)
└── navigation.ts   (NOUVEAU — listes blanches de navigation)
```

`navigation.ts` prend la config upstream **en entrée** et renvoie la liste blanche : chaque entrée conservée est **héritée par son `path`**, donc ses `matchPattern`, `nestedRoutes` et sous-entrées continuent de fonctionner. Seuls le libellé, l'icône et la garde de rôle sont surchargés.

```ts
// org-navigation.ts — le diff upstream se limite à ceci
const upstreamNavConfig: NavItemConfig[] = [
  /* inchangé */
];

export function getOrgNavConfig(isOrgAdmin: boolean | null): NavItemConfig[] {
  return applyOrgNavPolicy(upstreamNavConfig, isOrgAdmin);
}
```

**Pour restaurer une surface** : ajouter son `path` dans `ORG_NAV_V1` / `LMS_NAV_V1`, ou repasser le drapeau correspondant à `true` dans `features.ts`. Aucun code upstream à réécrire.

---

## 4. Correspondance nav → routes

### ADMIN

| Libellé        | Route                        | Garde           |
| -------------- | ---------------------------- | --------------- |
| Accueil        | `/org/{slug}/dash`           | —               |
| Formations     | `/org/{slug}/courses`        | —               |
| Employés       | `/org/{slug}/audience`       | —               |
| Progression    | `/org/{slug}/compliance`     | `requiresAdmin` |
| Certifications | `/org/{slug}/certifications` | —               |
| Administration | `/org/{slug}/settings`       | `requiresAdmin` |

Sous-entrées d'**Administration** conservées : Profil, Notifications, Organisation (+ Équipe, Personnalisation LMS).
Retirées : Landing page, Facturation, Crédits IA, Tuteur IA, Auth/SSO, Domaines personnalisés.

### TUTOR

Mêmes entrées **sans** Progression ni Administration → Accueil, Mes formations, Apprenants, Certifications.
Les libellés « Mes formations » / « Apprenants » remplacent « Formations » / « Employés » selon `isOrgAdmin`.
Le profil personnel du tuteur reste accessible par le menu avatar en bas de la sidebar.

### STUDENT

| Libellé         | Route               |
| --------------- | ------------------- |
| Accueil         | `/lms`              |
| Mes formations  | `/lms/mylearning`   |
| Mes certificats | `/lms/certificates` |

Le profil apprenant reste accessible par le menu avatar (`/lms/settings`).

---

## 5. Masqué dans la V1

| Surface                                          | Traitement                                     | Fichier                                            |
| ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------- |
| Créateur de cours IA (accueil org)               | Redirection 307 vers `/dash`                   | `org/[slug]/+page.server.ts`                       |
| Tuteur IA (onglet formation)                     | Filtré                                         | `course-sidebar-navigation.svelte`                 |
| Landing page publique (onglet formation)         | Filtré                                         | idem                                               |
| Communauté (org + LMS)                           | Hors liste blanche                             | `navigation.ts`                                    |
| Cohortes, Médias, Tags, Widgets, Setup           | Hors liste blanche                             | `navigation.ts`                                    |
| MCP, API publique, Zapier                        | Hors liste blanche                             | `navigation.ts`                                    |
| Analytics marketing                              | Hors liste blanche                             | `navigation.ts`                                    |
| Explore / catalogue apprenant                    | Hors liste blanche + section dashboard masquée | `navigation.ts`, `lms/pages/dashboard.svelte`      |
| Exercices (nav LMS)                              | Hors liste blanche                             | `navigation.ts`                                    |
| Facturation, crédits IA, tuteur IA, landing, SSO | Retirés des sous-onglets Administration        | `navigation.ts`                                    |
| Domaines personnalisés                           | Retiré des onglets Organisation                | `org-settings-inline-tabs.svelte`                  |
| Badge de plan payant                             | Supprimé de l'en-tête sidebar                  | `app-logo.svelte`                                  |
| Encart « Upgrade »                               | Retiré du pied de sidebar                      | `org-sidebar.svelte`                               |
| Sélecteur d'organisation / « ajouter une org »   | Mode organisation unique forcé                 | `org-switcher.svelte`, `org/[slug]/+layout.svelte` |

**Rien n'a été supprimé côté backend** : les routes API, services et pages restent en place et redeviennent accessibles dès qu'un drapeau ou une entrée de liste blanche est réactivé.

---

## 6. Nouvelle page : Certifications

`/org/{slug}/certifications` — la seule page créée dans ce sprint, car aucune vue certification à l'échelle de l'organisation n'existait upstream (seulement `/courses/{id}/certificates`, par formation).

- **Données** : endpoint existant `GET /dash/stats` (portée `orgMemberMiddleware` → admin **et** tuteur). Aucun nouvel endpoint, aucune requête SQL ajoutée.
- **Contenu** : certificats délivrés, apprenants totaux, taux de certification par formation, certifications récentes. Chaque ligne pointe vers l'onglet certificats de la formation concernée.
- **Limite connue** : `getCourseStats` est plafonné à 5 formations et `getRecentCertifications` à 5 entrées côté upstream. La page affiche donc un aperçu, pas un export exhaustif. Une liste complète demanderait un nouvel endpoint — hors périmètre de ce sprint.

`/dash/compliance-overview` (utilisé par « Progression ») est en `orgAdminMiddleware` : c'est pourquoi Progression est réservé à l'ADMIN, ce qui coïncide avec la spécification.

**Limite connue de Progression** : `getOrgComplianceLearnerRows` ne remonte que les formations de type `COMPLIANCE`. Les formations `SELF_PACED` n'y apparaissent pas. Si Celluloplast veut suivre toutes les formations à cet endroit, il faudra soit typer les formations obligatoires en `COMPLIANCE`, soit élargir la requête — décision métier, hors sprint.

---

## 7. Fichiers touchés

### Créés

| Fichier                                                                     | Objet                                   |
| --------------------------------------------------------------------------- | --------------------------------------- |
| `apps/dashboard/src/lib/celluloplast/features.ts`                           | Drapeaux de périmètre V1                |
| `apps/dashboard/src/lib/celluloplast/navigation.ts`                         | Listes blanches nav + libellés + gardes |
| `apps/dashboard/src/routes/(app)/org/[slug]/certifications/+page.server.ts` | Chargement `dash/stats`                 |
| `apps/dashboard/src/routes/(app)/org/[slug]/certifications/+page.svelte`    | Page Certifications                     |
| `docs/celluloplast/sprints/S03-navigation-dashboard.md`                     | Ce document                             |

### Modifiés

| Fichier                                                               | Nature du diff                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `features/ui/navigation/org-navigation.ts`                            | Renommage tableau + `getOrgNavConfig()` + 2 boucles (≈10 l.)       |
| `features/ui/navigation/lms-navigation.ts`                            | Renommage tableau + application de la politique (≈4 l.)            |
| `features/search/utils/static-catalog.ts`                             | Import + boucle sur `getOrgNavConfig(isOrgAdmin)` (2 l.)           |
| `features/ui/sidebar/org-sidebar/org-sidebar.svelte`                  | Retrait `<UpgradeTrigger />`                                       |
| `features/ui/sidebar/org-sidebar/app-logo.svelte`                     | Retrait du badge de plan                                           |
| `features/ui/sidebar/org-sidebar/org-switcher.svelte`                 | Mode organisation unique                                           |
| `features/settings/components/org-settings-inline-tabs.svelte`        | Filtre des onglets org                                             |
| `features/course/components/sidebar/course-sidebar-navigation.svelte` | Filtre IA / landing page (1 l.)                                    |
| `features/lms/pages/dashboard.svelte`                                 | Section catalogue masquée + CTA redirigé                           |
| `routes/(app)/org/[slug]/+page.server.ts`                             | Redirection 307 vers `/dash`                                       |
| `routes/(app)/org/[slug]/+layout.svelte`                              | `AddOrgModal` conditionné                                          |
| `lib/utils/translations/*.json` (10 locales)                          | +12 clés `celluloplast_navigation` / `celluloplast_certifications` |
| `packages/core/scripts/restore-bare-specifiers.mjs`                   | Correctif Windows (voir §9)                                        |

---

## 8. i18n

Deux namespaces isolés, ajoutés aux **10 locales** : `celluloplast_navigation` (9 clés) et `celluloplast_certifications` (3 clés).

FR : Accueil · Formations · Mes formations · Employés · Apprenants · Progression · Certifications · Mes certificats · Administration.

Le reste de la page Certifications réutilise des clés `dashboard.*` existantes plutôt que d'en créer.

> `pnpm translate` n'a **pas** pu être exécuté : le script exige `RAPID_API_KEY`, absente de `apps/dashboard/.env`. Les 8 locales non FR/EN ont donc été traduites manuellement. À revoir si ces langues deviennent réellement utilisées — non bloquant, l'usage cible étant FR.

---

## 9. Vérifications

| Étape           | Commande                                       | Résultat                       |
| --------------- | ---------------------------------------------- | ------------------------------ |
| Formatage       | `prettier --write` sur les fichiers modifiés   | OK                             |
| Dépendances     | `pnpm --filter @cio/dashboard^... build`       | OK                             |
| Build dashboard | `pnpm --filter @cio/dashboard build`           | **OK — construit en 3 m 60 s** |
| Route générée   | `.svelte-kit/output/server/.../certifications` | présente                       |
| Clés i18n       | présentes dans le bundle `chunks/en.js`        | OK                             |

Aucun avertissement du build ne concerne les fichiers de ce sprint (les avertissements Svelte restants proviennent de `packages/ui` en amont).

### Deux obstacles d'environnement rencontrés

1. **`pnpm format:changed` échoue sous Windows** : `scripts/format-changed.mjs` appelle `spawnSync('prettier', …)` sans `shell: true`, or `prettier` est un `.cmd` sous Windows. Contourné en appelant Prettier directement. Non corrigé pour rester proche d'upstream.
2. **`packages/core` ne compilait pas sous Windows** : `restore-bare-specifiers.mjs` utilisait `new URL(...).pathname`, qui produit `/C:/…` et donc un chemin `C:\C:\…`. Corrigé avec `fileURLToPath()` (2 lignes). Correctif de portabilité, sans effet sur le produit — bon candidat pour une contribution upstream.
3. **Build initialement en échec** : `JavaScript heap out of memory`. Le build du dashboard demande plus que les 4 Go par défaut de Node → lancer avec `NODE_OPTIONS="--max-old-space-size=8192"`. À retenir pour le VPS.

---

## 10. À vérifier manuellement (checklist QA)

- [ ] ADMIN : connexion → atterrissage sur `/dash` (et non le créateur IA)
- [ ] ADMIN : 6 entrées, dans l'ordre, aucune étiquette de groupe
- [ ] TUTOR : 4 entrées, libellés « Mes formations » / « Apprenants »
- [ ] TUTOR : `/compliance` et `/settings` absents de la sidebar **et** de Ctrl+K
- [ ] STUDENT : 3 entrées, profil accessible via l'avatar
- [ ] Ctrl+K : aucune suggestion Communauté / IA / Widgets / Facturation
- [ ] Fil d'Ariane cohérent sur chaque page conservée
- [ ] Onglets d'une formation : ni « Tuteur IA » ni « Landing page »

---

## 11. Suite

- **S04 — Vocabulaire métier** : le titre de la page Progression affiche encore « Conformité » (clé `compliance.title`) ; l'alignement Formation / Module / Cours est le sujet du sprint suivant, volontairement non entamé ici.
- **Achievements** : non commencés, conformément à la consigne.
