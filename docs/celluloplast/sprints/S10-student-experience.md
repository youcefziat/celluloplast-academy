# S10 — Simplification du parcours étudiant

> **Statut** : livré · **Aucune migration DB** · Prérequis S05–S09

---

# Goal

Simplifier le LMS étudiant Celluloplast pour le parcours :

```text
Connexion → Mes formations → Continuer → Modules/Cours → Progression → Certificat
```

Sans reconstruire le LMS ni ajouter d’endpoint.

---

# Existing LMS Flow

| Route | Rôle |
|-------|------|
| `/lms` | Accueil dashboard (`dashboard.svelte`) |
| `/lms/mylearning` | Formations inscrites |
| `/lms/certificates` | Certificats obtenus (`certificateEarnedAt`) |
| `/courses/{id}/lessons?next=true` | Continuer / reprendre |
| Contenu | `getContentItemsProgress` + arbre modules |

Nav STUDENT déjà bornée en S03 via `applyLmsNavPolicy`.

---

# Student Navigation

Conservée :

```text
Accueil           → /lms
Mes formations    → /lms/mylearning
Mes certificats   → /lms/certificates
```

Toujours masqués : explore, community, cohorts, exercises, settings group, AI.

---

# Home

Accueil simplifié :

- Salutation (inchangée)
- Liste des formations (tri : En cours → Non commencées → Terminées)
- Progression % + statut + CTA Commencer / Continuer / Revoir
- Bloc « Mes certificats » avec compteur + lien

Masqués : cartes streak / compliance score / explore catalog / liens publics.

---

# My Learning

Trois onglets :

- En cours
- Non commencées
- Terminées

Plus de lien vers `/lms/explore`.  
Réutilise `CoursesPage` + cartes LMS.

---

# Course Experience

- CTA carte : Commencer / Continuer / Revoir selon progression
- Navigation contenu upstream inchangée (`?next=true`)
- Vocabulaire FR Formation / Module / Cours / Quiz

---

# Module Progress

Réutilise `getContentItemsProgress` dans l’arbre de contenu.

Label affiché :

```text
{completed} / {total} cours
```

Aucun nouvel état stocké.

---

# Certificates

`/lms/certificates` inchangé techniquement (cartes + `certificateEarnedAt`).

Vocabulaire :

- Mes certificats
- Voir mon certificat
- Obtenu le

CTA formation terminée avec certificat → `/courses/{id}/certificates`.

---

# Hidden Features

Côté STUDENT Celluloplast :

- AI Tutor / Ask AI (déjà `CELLULOPLAST_V1.ai = false`)
- Community / news feed / explore / cohorts
- Stats SaaS (streak, compliance score)
- Marketplace / multi-org (flags V1 existants)

Backend préservé.

---

# Vocabulary

Clés `celluloplast_lms.*` + mise à jour FR `my_learning` / `certificates`.

Identifiants internes inchangés.

---

# Files Changed

### Créés

- `apps/dashboard/src/lib/celluloplast/lms.ts`
- `docs/celluloplast/sprints/S10-student-experience.md`

### Modifiés

- `features/lms/pages/dashboard.svelte`
- `features/lms/pages/mylearning.svelte`
- `features/course/components/card.svelte`
- `features/course/components/sidebar/course-content-tree.svelte`
- `features/course/components/mobile/course-mobile-outline-tree.svelte`
- `routes/(app)/lms/+page.svelte`
- `routes/(app)/lms/mylearning/+page.svelte`
- `routes/(app)/lms/certificates/+page.svelte`
- 10 locales (`celluloplast_lms` + FR my_learning/certificates)

---

# Verification

| Check | Résultat |
|-------|----------|
| Audit LMS + nav | OK |
| Prettier (fichiers S10) | OK |
| `pnpm --filter @cio/dashboard exec vite build --sourcemap false` | OK (exit 0 ; sourcemaps désactivés pour tenir sur disque) |
| Migration DB | Aucune |
| API build | Non requis (dashboard only) |
| E2E navigateur | Non exécuté |

---

# Known Limitations

- Progression module = compteur items (pas un % stocké)
- Pas de redesign responsive profond
- Locales hors FR/EN : clés EN pour `celluloplast_lms`
- E2E navigateur non exécuté dans ce sprint

---

# Follow-up

**S11 recommandé** : raffiner la page org Employés/Audience (vocabulaire RH) **ou** préparation déploiement VPS — sans SSO / Entra ID / achievements.
