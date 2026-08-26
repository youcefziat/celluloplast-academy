# S06 — Certifications organisationnelles

> **Statut** : livré · **Aucune migration DB** · Prérequis S05 (`learning-overview`)

---

# Goal

Transformer `/org/{slug}/certifications` en liste complète des certificats (`certificateEarnedAt IS NOT NULL`), sans le plafond de `dash/stats`.

---

# Existing Certificate Mechanism

| Élément | Emplacement |
|---------|-------------|
| Trace V1 | `groupmember.certificate_earned_at` |
| PDF on-demand | `POST /course/:courseId/download/certificate` |
| Rendu | `assembleCertificateRender` + `packages/certificates` |
| UI apprenant | `/lms/certificates` → `unlocked-certificate.svelte` |
| Garde | `assertCertificateDownloadAllowed(courseId, profileId)` |

Le PDF n’est **jamais** stocké ; régénéré à chaque téléchargement.

---

# Data Source

**Réutilisation de `GET /dash/learning-overview`** — pas de nouvel endpoint.

Raisons :
- contient déjà `certificateEarnedAt`, employé, formation, avatar
- même scope ADMIN / TUTOR que S05
- une seule requête SQL déjà agrégée (pas de duplication)

Filtre frontend : `certificateEarnedAt != null`, tri par date décroissante.

`+page.server.ts` (ancien `dash/stats`) **supprimé**.

---

# Authorization

| Rôle | Liste | Téléchargement PDF |
|------|-------|--------------------|
| ADMIN | toute l’org (via learning-overview) | oui, via `isCourseTeamMemberOrOrgAdmin` |
| TUTOR | ses formations seulement (S05) | oui, s’il est team du cours |
| STUDENT | page org absente | `/lms/certificates` inchangé |

---

# UI

Page `/org/{slug}/certifications` :
- recherche employé
- filtre formation
- colonnes : Employé · Formation · Obtenu le · Action (Voir)
- empty : « Aucun certificat obtenu pour le moment. »
- pagination client (50)

Nav inchangée : `Certifications → /certifications`.

---

# Certificate Download

**Limitation upstream découverte** : l’API vérifiait l’éligibilité sur l’**appelant**, pas sur l’apprenant ciblé. Un admin ne pouvait donc pas télécharger le PDF d’un employé.

**Modification minimale** (`loadCertificateInput` dans `routes/course/course.ts`) :
1. Si `studentId` ≠ caller → exiger `isCourseTeamMemberOrOrgAdmin`
2. Puis `assertCertificateDownloadAllowed(courseId, studentId)`
3. Sinon comportement self-download inchangé

Le bouton « Voir » appelle le même `POST .../download/certificate` avec `studentName`, `studentId`, `issuedAt` (= `certificateEarnedAt`).

Pas de stockage PDF, pas de nouveau générateur.

---

# Performance

- Liste : **0** nouvelle requête SQL (réutilise learning-overview / cache client partagé avec Progression)
- Téléchargement : 1 appel PDF au clic

---

# Files Changed

### Créés
- `apps/dashboard/src/lib/features/certifications/**`
- `docs/celluloplast/sprints/S06-certifications.md`

### Modifiés
- `apps/dashboard/src/routes/(app)/org/[slug]/certifications/+page.svelte`
- `apps/api/src/routes/course/course.ts` (`loadCertificateInput`)
- 10 locales (`celluloplast_certifications`)

### Supprimés
- `.../certifications/+page.server.ts` (source `dash/stats`)

---

# Verification

| Étape | Résultat |
|-------|----------|
| Prettier (fichiers S06) | OK |
| `@cio/api` build | OK |
| `@cio/dashboard` build | OK (3 m 12 s) |
| Route générée `org/.../certifications` | présente |
| Clés i18n `celluloplast_certifications` | présentes dans le bundle |

Checklist manuelle : ADMIN/TUTOR/STUDENT, empty/1/N certificats, recherche, filtre, Voir PDF, isolation org.

---

# Known Limitations

- Un certificat courant par (employé, formation) — pas d’historique
- Org TUTOR hors `groupmember` du cours : ne voit pas / ne télécharge pas (cohérent S05)
- `certificate.isDownloadable === false` → téléchargement refusé (garde upstream)
- Locales non FR/EN : clés EN pour les nouvelles chaînes

---

# Follow-up

**S07 recommandé** (si besoin métier) : vocabulaire Formation/Module/Cours en i18n, ou durcissement VPS — **pas** certificats module / archivage PDF / recertification.
