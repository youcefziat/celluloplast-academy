# Celluloplast Academy — Roadmap (petits sprints)

> Plan de migration / adaptation. **Aucun code tant que ce document + ARCHITECTURE + PRODUCT_SCOPE ne sont pas validés.**

---

## Principes de livraison

1. **Masquer avant de modifier** ; **modifier avant de supprimer**.  
2. Chaque sprint doit rester **rebaseable** sur upstream ClassroomIO.  
3. Pas de big-bang rewrite.  
4. Vérifier Docker self-host après chaque sprint « infra / UI critique ».  
5. Respecter `AGENTS.md` upstream (layers API, Conventional Commits, builds, i18n).

---

## État actuel du workspace

| Élément | État |
|---------|------|
| Code ClassroomIO à la racine | **Absent** |
| Clone d’analyse | `_upstream_classroomio/` |
| Docs Celluloplast | `docs/celluloplast/` (ce dossier) |
| Branding assets | Image Adobe Express à la racine (à intégrer plus tard) |

**Sprint 0** initialise proprement le fork.

---

## Sprint 0 — Fondations fork & runtime

**Objectif** : dépôt utilisable + stack qui démarre.

- [ ] Initialiser le repo à partir de ClassroomIO (`git clone` / remote `upstream`).  
- [ ] Ajouter remote `origin` (fork privé Celluloplast).  
- [ ] Conserver / versionner `docs/celluloplast/*`.  
- [ ] `.env` self-host (`PUBLIC_IS_SELFHOSTED=true`, secrets, SMTP, MinIO).  
- [ ] `docker compose` / `classroomio.sh` : postgres, redis, minio, api, dashboard, jobs.  
- [ ] Bootstrap 1ʳᵉ org + compte ADMIN.  
- [ ] Smoke test : login, créer un cours, ajouter une leçon.  
- [ ] Documenter la procédure VPS (ports, reverse proxy, backups) dans `docs/celluloplast/DEPLOY.md` *(à créer dans ce sprint)*.

**Hors sprint** : branding, masquage features, i18n métier.

**Critère done** : un admin se connecte en local/VPS de test et crée un cours.

---

## Sprint 1 — Périmètre UI (masquage)

**Objectif** : l’UI ne propose plus les features hors V1.

- [ ] Filtrer `org-navigation.ts` : retirer / cacher community, widgets, cohorts, automation (MCP/API/Zapier), stats non nécessaires si trop bruyant.  
- [ ] Filtrer `lms-navigation.ts` : community off, explore selon décision métier, cohorts off.  
- [ ] Masquer settings : billing, AI credits, AI tutor, landing page, domains (et auth SSO si non décidé).  
- [ ] Désactiver par défaut `customization.dashboard.community` et `exercise` (ou laisser exercise ON si quiz V1 validé).  
- [ ] Masquer / neutraliser triggers d’upgrade (`upgrade-trigger`, PremiumIcon) en self-host.  
- [ ] Ne **pas** supprimer les routes API sous-jacentes.

**Critère done** : parcours Admin/Tutor/Student sans lien visible vers IA, billing, communauté, marketplace.

---

## Sprint 2 — Branding Celluloplast Academy

**Objectif** : l’app « ressemble » à Celluloplast, pas à ClassroomIO.

- [ ] Remplacer logos / favicon / titres (sidebar `app-logo`, auth pages, `<title>`).  
- [ ] Thème org (couleur primaire Celluloplast) via settings existants.  
- [ ] Bannières LMS / fond auth (`customize-lms`).  
- [ ] Templates certificats (`packages/certificates`) aux couleurs / logo Celluloplast.  
- [ ] Relecture pages login / onboarding (textes).  

**Critère done** : captures d’écran validées « brand test » (marque visible hors simple nav).

---

## Sprint 3 — Vocabulaire métier & parcours FR

**Objectif** : Formation / Module / Cours dans l’UI, sans changer le schéma.

- [ ] Clés i18n FR (et EN si besoin) : Course→Formation, Section→Module, Lesson→Cours.  
- [ ] Parcours guidé minimal doc interne : créer formation → modules → cours → assigner → suivre → certificat.  
- [ ] Vérifier flux certificat de bout en bout (complétion → émission → téléchargement student).  
- [ ] Ajuster copy empty-states LMS (`mylearning`, `certificates`).

**Critère done** : un utilisateur non technique suit le parcours sans jargon ClassroomIO (« cohort », « widget », etc.).

---

## Sprint 4 — Rôles & assignation (durcir le V1)

**Objectif** : coller aux responsabilités ADMIN / TUTOR / STUDENT.

- [ ] Vérifier invites org (ADMIN crée users / tutors / students).  
- [ ] Vérifier assignation formation (people / invite cours).  
- [ ] Clarifier droits TUTOR (création cours vs édition seule) — config ou doc selon natif.  
- [ ] Signup : mode **invite-only** recommandé (`organization.settings.signup`).  
- [ ] Revue progression : écrans admin (audience / course people / dash) suffisants ? micro-ajustements UX seulement.  
- [ ] Tests manuels des 3 personas (checklist).

**Critère done** : checklist personas 100 % verte sur environnement de staging.

---

## Sprint 5 — Exploitation VPS

**Objectif** : production interne stable.

- [ ] Reverse proxy (TLS) vers dashboard (+ api si exposée).  
- [ ] SMTP entreprise.  
- [ ] Backups Postgres + volumes MinIO.  
- [ ] Monitoring basique (healthchecks compose).  
- [ ] Procédure upgrade : pin version / merge upstream + rebuild.  
- [ ] Runbook incident (restart jobs, files Redis, disque média).

**Critère done** : go-live interne avec 1 formation pilote et un groupe d’apprenants test.

---

## Sprint 6 (optionnel) — Durcissement & dette contrôlée

À lancer seulement si le pilote le demande :

- [ ] Feature-flag module `celluloplast` centralisant les masquages (facilite merges).  
- [ ] Restreindre Explore (catalogue) si politique « assignation only ».  
- [ ] Quiz/exercices activés proprement sur formations critiques.  
- [ ] Premier merge/rebase documenté depuis `upstream`.  
- [ ] Décision cohorts (programmes multi-formations) pour V1.1.

---

## Backlog explicitement reporté (post-V1)

| Sujet | Pourquoi plus tard |
|-------|--------------------|
| SSO Microsoft / Google Workspace | License + config IdP |
| Public API / webhooks RH | Besoin intégration non bloquant |
| Cohorts / programmes annuels | Complexité UI |
| Community interne | Hors vision actuelle |
| IA authoring / tutor | Exclu produit |
| SCORM | Non shipped upstream |
| Multi-org | Contredit self-host interne |

---

## Ordre de dépendance

```
Sprint 0 (fork + Docker)
    → Sprint 1 (masquage UI)
        → Sprint 2 (branding)
            → Sprint 3 (vocabulaire + certificat E2E)
                → Sprint 4 (rôles / assignation)
                    → Sprint 5 (VPS prod)
                        → Sprint 6 (optionnel)
```

Les sprints 1–3 peuvent être partiellement parallélisés **après** Sprint 0, mais le masquage (1) avant le branding (2) évite de polir des écrans qu’on retire.

---

## Estimation indicative

| Sprint | Effort indicatif | Risque merge upstream |
|--------|------------------|----------------------|
| 0 | 1–3 j | Faible |
| 1 | 1–2 j | Faible (fichiers nav/settings) |
| 2 | 1–3 j | Faible–moyen (assets) |
| 3 | 1–2 j | Faible (i18n) |
| 4 | 2–4 j | Faible (config + QA) |
| 5 | 2–5 j | N/A (ops) |
| 6 | variable | Moyen si flags mal isolés |

---

## Gate de validation (maintenant)

Avant Sprint 0, valider explicitement :

1. [ ] `ARCHITECTURE.md` — mapping Formation=Course, Module=Section, Cours=Lesson  
2. [ ] `PRODUCT_SCOPE.md` — exclus V1 (IA, community, billing, multi-org, etc.)  
3. [ ] Ce `ROADMAP.md` — enchaînement des sprints  
4. [ ] Décisions ouvertes §8 de `PRODUCT_SCOPE.md` (explore, quiz, certificats module, SSO)

**Réponse attendue** : validation écrite (éventuellement avec amendements), puis autorisation de démarrer le Sprint 0 uniquement.
