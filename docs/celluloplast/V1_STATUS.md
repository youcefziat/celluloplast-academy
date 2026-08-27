# Celluloplast Academy — Statut V1

> Synthèse produit / technique avant test manuel localhost.
> Code fork : `_upstream_classroomio/` · Couche UI : `apps/dashboard/src/lib/celluloplast/`

---

# Product Scope

LMS interne self-hosté Celluloplast (fork ClassroomIO) :

- Créer des formations (modules / cours / quiz)
- Assigner des employés
- Suivre la progression
- Délivrer des certificats PDF on-demand

Rôles : **ADMIN**, **TUTOR**, **STUDENT**.  
Principe : masquer > configurer > modifier > supprimer (rebaseable sur upstream).

---

# Implemented

| Domaine | État |
|---------|------|
| Branding Celluloplast Academy | Oui (`brand.ts`, logo, favicon) |
| Nav ADMIN / TUTOR / STUDENT | Oui (S03 + S05 Progression) |
| Authoring simplifié SELF_PACED | Oui (S07) |
| Settings formation simplifiés + certificat 100 % | Oui (S08) |
| Assignation employés (sans hard-delete UI) | Oui (S09) |
| Progression org type-agnostique `/progress` | Oui (S05) |
| Certifications org `/certifications` | Oui (S06) |
| LMS étudiant simplifié | Oui (S10) |
| Flags SaaS off (AI, billing, community…) | Oui (`features.ts`) |
| Vocabulaire FR parcours V1 (Employés, Formations…) | Oui (S07–S11) |
| Migration DB dédiée Celluloplast | **Oui** — `0007` (HR texte) + `0008` (référentiels postes/départements) |
| Création employés (formulaire + CSV + invite) | Oui (août 2026) |
| Référentiels Postes / Départements (CRUD admin) | Oui (S12) |
| Paramètres org (nom + logo) — save fix | Oui (août 2026) |
| Upload image (profil + org) — erreurs explicites | Oui (S12) |
| Header sans « Académie ouverte » (exploreCatalog off) | Oui (S12) |
| Tenant unique Celluloplast (seed + org-context) | Oui (août 2026) |

---

# Roles

| Rôle | Capacités V1 |
|------|----------------|
| ADMIN | Formations, Employés, Progression, Certifications, Administration ; crée / publie / assigne |
| TUTOR | Mes formations autorisées, Apprenants, Progression & Certifications scopés ; pas d’Administration |
| STUDENT | Accueil LMS, Mes formations, Mes certificats ; pas d’authoring ni vues org |

Permissions = upstream (`requiresAdmin`, membership cours). Pas de nouveau système de rôles.

---

# Main Routes

| Surface | Route |
|---------|-------|
| Accueil org | `/org/{slug}/dash` |
| Formations | `/org/{slug}/courses` |
| Employés / Apprenants | `/org/{slug}/audience` |
| Progression | `/org/{slug}/progress` |
| Certifications org | `/org/{slug}/certifications` |
| Administration | `/org/{slug}/settings` (+ notifications, org, teams, customize-lms, **positions**, **departments**) |
| LMS | `/lms`, `/lms/mylearning`, `/lms/certificates` |
| Contenu formation | `/courses/{id}/lessons`, people, settings, certificates |

---

# Database Changes

**Migration Celluloplast `0008_organization_hr_references`** — tables `organization_position` / `organization_department` ; FKs `position_id` / `department_id` sur `organizationmember` (remplace les colonnes texte de `0007`).

Voir `docs/celluloplast/sprints/S12-employee-references-and-upload-fixes.md`.

---

# API Changes

| Endpoint / zone | Sprint |
|-----------------|--------|
| `GET /dash/learning-overview` | S05 |
| Certifications org (réutilise certificats existants) | S06 |
| Assignation audience → courses (upstream) | S09 |
| `POST /organization/audience` — créer employé + invite | août 2026 |
| `POST /organization/audience/import` — import CSV multi-colonnes | août 2026 |
| `GET/POST/PUT/DELETE /organization/positions` | S12 |
| `GET/POST/PUT/DELETE /organization/departments` | S12 |

Pas de nouveau moteur d’enrollment ni d’archivage PDF.

---

# Celluloplast Fork Files

```text
apps/dashboard/src/lib/celluloplast/
  brand.ts
  features.ts
  navigation.ts
  course-authoring.ts
  people.ts
  lms.ts

apps/dashboard/src/lib/features/learning-overview/
apps/dashboard/src/lib/features/certifications/
apps/dashboard/src/routes/(app)/org/[slug]/progress/
apps/dashboard/src/routes/(app)/org/[slug]/certifications/

packages/db/src/queries/dash/learning-overview.ts
packages/certificates/src/celluloplast-brand.ts
packages/email/src/celluloplast-brand.ts

docs/celluloplast/*
```

---

# Hidden Upstream Features

Masqués (backend souvent intact) :

- AI Tutor / crédits IA / génération IA
- Community, news feed, explore catalog
- Billing / plans / upgrade
- Multi-org UI
- Automation (MCP, API keys, Zapier)
- Cohorts, landing marketing, widgets, media manager (nav)
- Import / export CSV Employés (V1)
- Retrait hard-delete membre formation (UI)
- Types LIVE / COMPLIANCE / PUBLIC à la création (filtre liste = SELF_PACED)

Accès direct par URL à certaines routes upstream encore possible → limitation acceptée (pas de rewrite de garde-fous).

---

# Known Limitations

- 1 certificat courant par employé / formation (`certificate_earned_at`)
- Pas d’historique certificat / archivage PDF durable
- PDF généré on-demand
- Pas de retrait d’employé dans l’UI
- Pas de CSV / sync Entra ID / SSO
- Locales hors FR/EN souvent en anglais pour clés Celluloplast
- Pagination client sur certains datasets
- `/compliance` et autres surfaces masquées encore joignables par URL
- Jest dashboard upstream cassé → pas de suite E2E Celluloplast automatisée

---

# Manual Test Required

Voir `docs/celluloplast/LOCAL_TEST_GUIDE.md` — checklist ADMIN / TUTOR / STUDENT + empty states.

---

# Ready for Production Criteria

Avant S12 (VPS) :

1. Checklist localhost OK sur les 3 personas  
2. Builds verts (`utils`, `db`, `api`, `dashboard`)  
3. Secrets / SMTP / MinIO / backups définis hors repo  
4. Une org Celluloplast + comptes de test validés  
5. Aucune régression critique navigation / certificat / assignation  

---

# Future Ideas

À noter seulement (non implémentés) :

- SSO Entra ID  
- CSV / import RH  
- Certificat au niveau module  
- Recertification  
- Historique des certificats  
- Intégrations RH éventuelles  
