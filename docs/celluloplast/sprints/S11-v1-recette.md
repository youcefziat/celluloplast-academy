# S11 — Recette V1 et stabilisation

> **Statut** : livré · **Aucune nouvelle feature métier** · Prérequis S03–S10  
> Objectif : corriger les écarts visibles + docs de test localhost avant S12.

---

# Goal

Recette du parcours V1 (ADMIN / TUTOR / STUDENT), corrections d’affichage / vocabulaire / UX, builds verts, guides `LOCAL_TEST_GUIDE.md` et `V1_STATUS.md`.

---

# Bugs trouvés

| Priorité | Problème |
|----------|----------|
| P0 | Page Employés : titre « Audience » / H1 « Public », jargon Invite/Course |
| P0 | Titres document EN (Courses, Welcome back…) |
| P0 | Filtre Formations proposait LIVE / COMPLIANCE / PUBLIC |
| P0 | Boutons Import/Export CSV + compteurs plan sur Employés (hors V1) |
| P1 | FR « leçons » dans compteurs sidebar cours |
| P1 | Mentions ClassroomIO dans sous-titres profil / notifications FR |
| P2 | Routes hors V1 encore joignables par URL (limitation acceptée) |

---

# Bugs corrigés

- Titres `pageTitle()` : Employés, Formations, login
- Vocabulaire FR/EN audience → Employés / formations
- Filtre types = `CELLULOPLAST_COURSE_TYPES` (`SELF_PACED`)
- Suppression UI import/export CSV + limites plan sur `/audience`
- FR sidebar : « cours » à la place de « leçons »
- Sous-titres profil / notifications → Celluloplast Academy

---

# Non corrigé (limitations acceptées)

- Pas de soft-redirect global des URLs hors V1
- Pas de suite E2E automatisée (Jest dashboard upstream cassé)
- Pas de retrait employé UI, CSV, SSO, historique certificat
- Locales secondaires incomplètes

---

# Verification

| Check | Résultat |
|-------|----------|
| Audit nav / authoring / assign / progress / certs / permissions (code) | OK |
| Prettier (fichiers S11) | OK |
| `pnpm --filter @cio/utils build` | OK |
| `pnpm --filter @cio/db build` | OK |
| `pnpm --filter @cio/api build` | OK |
| `pnpm --filter @cio/dashboard exec vite build --sourcemap false` | OK |
| Migration DB | Aucune |
| E2E navigateur | À faire par le propriétaire (`LOCAL_TEST_GUIDE.md`) |

---

# Docs livrés

- `docs/celluloplast/LOCAL_TEST_GUIDE.md`
- `docs/celluloplast/V1_STATUS.md`
- `docs/celluloplast/sprints/S11-v1-recette.md` (ce fichier)

---

# Follow-up

**S12** uniquement après validation manuelle localhost — déploiement VPS (hors scope S11).
