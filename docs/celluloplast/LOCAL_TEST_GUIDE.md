# Celluloplast Academy — Guide de test localhost (V1)

> Pour le propriétaire du projet. Recette manuelle complète avant S12 (déploiement).
> Code : `_upstream_classroomio/` · Docs : `docs/celluloplast/`

---

## Prérequis

| Outil | Version / note |
|-------|----------------|
| Node | **20.x** (voir `.nvmrc` ; éviter Node 24 si possible) |
| pnpm | 10.x (workspace) |
| Docker Desktop | Requis pour Postgres / Redis / MinIO |
| Git | Oui |
| Espace disque | ≥ 10 Go libres recommandés sur C: (builds lourds) |

Variables utiles (ne pas committer de secrets réels) :

- `PUBLIC_IS_SELFHOSTED=true`
- `DASHBOARD_ORIGIN` / `PUBLIC_SERVER_URL`
- `BETTER_AUTH_SECRET`, `PRIVATE_SERVER_KEY`
- `DATABASE_URL`, Redis, MinIO si hors compose

Modèles : `_upstream_classroomio/.env.example`, `apps/dashboard/.env.example`, `packages/db/.env.example`.

---

## Démarrage — option A (Docker stack complète)

Depuis `_upstream_classroomio/` :

```powershell
cd C:\Users\ILYES\Desktop\CelluloplastAcademy\_upstream_classroomio
copy .env.example .env
# Éditer .env : PUBLIC_IS_SELFHOSTED=true, DASHBOARD_ORIGIN=http://localhost:3082,
# PUBLIC_SERVER_URL=http://localhost:3081, secrets BETTER_AUTH_SECRET / PRIVATE_SERVER_KEY

# Bash / Git Bash recommandé pour le script :
bash ./classroomio.sh start --build
```

Services attendus :

| Service | URL / port |
|---------|------------|
| Dashboard | http://localhost:3082 |
| API | http://localhost:3081 |
| Postgres | localhost (compose) |
| Redis | localhost (compose) |
| MinIO | profile `minio` (compose) |
| Jobs worker | inclus dans le stack (obligatoire pour e-mails / médias) |

---

## Démarrage — option B (dev pnpm + deps Docker)

```powershell
cd C:\Users\ILYES\Desktop\CelluloplastAcademy\_upstream_classroomio
copy .env.example .env
# Copier aussi apps/dashboard/.env.example → .env et packages/db/.env.example si besoin

pnpm install

# Dépendances infra uniquement
docker compose up -d postgres redis
# Médias (recommandé) :
docker compose --profile minio up -d minio minio-init

# Terminal 1 — API + core + jobs
pnpm api:dev

# Terminal 2 — Dashboard + UI
pnpm dashboard:dev
```

| Service | URL |
|---------|-----|
| Dashboard (Vite) | http://localhost:5173 |
| API | http://localhost:3081 (selon `.env`) |

---

## URLs utiles

| Persona | URL typique |
|---------|-------------|
| Login | `/login` |
| Accueil ADMIN/TUTOR | `/org/{slug}/dash` |
| Formations | `/org/{slug}/courses` |
| Employés / Apprenants | `/org/{slug}/audience` |
| Progression | `/org/{slug}/progress` |
| Certifications (org) | `/org/{slug}/certifications` |
| Administration | `/org/{slug}/settings` (ADMIN) |
| LMS étudiant | `/lms`, `/lms/mylearning`, `/lms/certificates` |

---

## Comptes

Ne pas stocker de mots de passe réels dans ce dépôt.

1. Au premier démarrage : créer l’organisation + compte **ADMIN** (onboarding / signup self-host).
2. Inviter un **TUTOR** via Administration → Équipes (rôle tuteur) et l’ajouter comme membre d’au moins une formation.
3. Inviter / ajouter un **STUDENT** via Employés (audience) ou People d’une formation (`?add=true`).

Scénario minimal : 1 admin, 1 tuteur, 1 étudiant sur la même org.

---

## Scénario de recette (checklist)

### ADMIN

```text
[ ] login admin
[ ] Accueil visible (nav : Accueil, Formations, Employés, Progression, Certifications, Administration)
[ ] créer formation (SELF_PACED, pas de sélecteur LIVE/IA)
[ ] créer module
[ ] créer cours
[ ] créer quiz
[ ] certificat activé (threshold 100)
[ ] publier
[ ] assigner étudiant (1 puis plusieurs ; doublon déjà inscrit OK)
[ ] page progression (recherche, filtre formation, filtre statut)
[ ] page certifications (liste + Voir PDF)
[ ] Administration (profil / org / équipes) — pas de billing / AI / landing
```

### STUDENT

```text
[ ] login étudiant
[ ] Accueil LMS
[ ] Mes formations (empty state si aucune)
[ ] Commencer / Continuer
[ ] suivre module → cours → quiz
[ ] progression visible
[ ] terminer à 100 %
[ ] certificat (Mes certificats + téléchargement)
[ ] empty state « Aucun certificat » si applicable
[ ] pas d’accès authoring / settings org / progression org (sidebar + URL directe si testé)
```

### TUTOR

```text
[ ] login tutor
[ ] nav : Accueil, Mes formations, Apprenants, Progression, Certifications (pas Administration)
[ ] modifier uniquement ses formations autorisées
[ ] voir apprenants / progression / certificats dans le scope
[ ] vérifier permissions (pas d’élévation, pas de données hors scope)
```

### Hors V1 (ne doivent pas réapparaître dans le parcours)

```text
[ ] pas d’AI Tutor / chat IA / génération IA dans l’UI
[ ] pas de community / news feed / explore / marketplace / billing
[ ] pas d’import CSV Employés (masqué)
[ ] filtre Formations : SELF_PACED seulement
```

---

## Logs en cas d’erreur

| Symptôme | Où regarder |
|----------|-------------|
| Dashboard blanc / SSR | Terminal `pnpm dashboard:dev` ou logs container `dashboard` |
| 401 / 403 API | Terminal `pnpm api:dev` / container `api` ; cookies / `PRIVATE_SERVER_KEY` |
| Jobs (e-mail, vidéo) bloqués | Worker jobs (inclus dans `pnpm api:dev` ou container `jobs`) |
| DB | `docker compose logs postgres` |
| Redis | `docker compose logs redis` |
| Navigateur | Console DevTools + Network (404, 500) |

Ne pas committer les `.env` ni les dumps.

---

## Builds de référence (déjà validés en S11)

```powershell
cd C:\Users\ILYES\Desktop\CelluloplastAcademy\_upstream_classroomio
pnpm --filter @cio/utils build
pnpm --filter @cio/db build
pnpm --filter @cio/api build
pnpm --filter @cio/dashboard exec vite build --sourcemap false
```

> Note : sourcemaps désactivés pour le build dashboard si l’espace disque est juste.

---

## Après validation manuelle

Le prochain sprint est **S12** (déploiement VPS) **uniquement** après OK localhost.
