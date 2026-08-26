# Celluloplast Academy — Périmètre produit V1

> Document de scope. **Pas de code.** À valider avant tout sprint d’implémentation.

---

## 1. Vision

**Celluloplast Academy** est le LMS interne self-hosté de Celluloplast, fork de ClassroomIO.

Objectif V1 : permettre à l’entreprise de **créer des formations**, **les assigner**, **suivre la progression**, et **délivrer des certificats** — avec trois rôles : Admin, Tutor, Student.

Hors vision V1 : produit commercial multi-clients, IA, communauté, marketplace, partenaires.

---

## 2. Personas & capacités V1

### ADMIN

| Capacité | Inclus V1 | Source ClassroomIO |
|----------|-----------|-------------------|
| Gérer les utilisateurs (inviter, rôles, désactiver) | Oui | Audience, Teams, Invites org |
| Créer / éditer / archiver des formations | Oui | Courses |
| Créer modules et cours (contenu) | Oui | Sections + Lessons (+ média) |
| Assigner des formations | Oui | Course people / invites |
| Consulter la progression | Oui | Dash / analytics / roster cours |
| Consulter les certifications | Oui | Certificates + completion records |
| Paramètres org (nom, logo, thème, signup) | Oui | Settings org / customize LMS |
| Billing / plans / upgrade | **Non** | Masquer |
| API keys / MCP / Zapier | **Non** (sauf besoin RH ultérieur) | Masquer |
| SSO entreprise | Reporté | Existe mais license-gated ; hors V1 |

### TUTOR

| Capacité | Inclus V1 | Source |
|----------|-----------|--------|
| Créer et modifier les formations autorisées | Oui | Rôle TUTOR + membership cours |
| Gérer cours / modules de leurs formations | Oui | Course editor |
| Voir la progression des apprenants concernés | Oui | People / submissions / marks |
| Modifier settings org / billing / membres globaux | **Non** | Déjà restreint côté API |

### STUDENT

| Capacité | Inclus V1 | Source |
|----------|-----------|--------|
| Voir ses formations | Oui | `/lms/mylearning` |
| Consulter les cours | Oui | Lesson player |
| Terminer les modules / leçons | Oui | `lesson_completion` |
| Voir sa progression | Oui | LMS home / my learning |
| Télécharger ses certificats | Oui | `/lms/certificates` |
| Communauté Q&A | **Non** | Masquer (toggle déjà prévu) |
| Explore catalogue public large | Optionnel | Simplifier / restreindre si assignation only |
| AI Lesson Tutor | **Non** | Masquer / ne pas configurer de clés |

---

## 3. Modèle pédagogique V1

```
Formation          →  Course (ClassroomIO)
  Module           →  Section
    Cours          →  Lesson
    Achievement    →  Complétion (leçon ± exercice)
    Certificat     →  Certificate issue (optionnel par formation)
```

Règles V1 :

1. Une **Formation** est l’unité d’assignation et de certification.
2. Les **Modules** structurent le parcours (sections).
3. Les **Cours** sont les contenus à consulter / marquer terminés (lessons).
4. Un **Achievement** n’est **pas** un système de badges gamifiés : c’est la validation d’étape (complétion).
5. Un **certificat** peut être émis à la fin de la Formation (moteur existant).
6. Les **exercices / quiz** sont **optionnels** (utiles pour valider un module) — pas obligatoires pour toutes les formations.
7. Les **cohorts / programmes multi-cours** sont **hors V1** sauf besoin métier explicite ultérieur.

---

## 4. Inclus V1 (liste positive)

### Plateforme

- Self-host Docker sur VPS Celluloplast  
- Une organisation unique « Celluloplast »  
- Auth email/password (Better Auth)  
- Rôles ADMIN / TUTOR / STUDENT  
- Invites utilisateurs (org + formation)  
- Médias (upload docs/vidéo via MinIO) — nécessaire au contenu  
- Emails transactionnels (invites, welcome) si SMTP configuré  
- Branding Celluloplast Academy (logo, thème, textes FR)  

### Pédagogie & suivi

- CRUD formations / modules / cours  
- Assignation apprenants  
- Progression (libre ou séquentielle via metadata existante)  
- Vue progression admin/tutor  
- Certificats téléchargeables  

### Surfaces UI

- Workspace org (`/org/...`) pour admin & tutors  
- LMS (`/lms/...`) pour students  
- Settings essentiels (profil, org, teams, customize LMS)  

---

## 5. Exclus V1 (liste négative)

À **ne pas construire**, et à **masquer** dans l’UI quand déjà présents upstream :

| Domaine | Exemples ClassroomIO | Traitement V1 |
|---------|----------------------|---------------|
| IA | Agent course builder, AI tutor, AI credits, MCP | Masquer nav + ne pas fournir clés providers |
| Communauté / social | Community Q&A, newsfeed (usage social) | Désactiver customize LMS + masquer nav |
| Partenaires / marketplace | Widgets embed, org-site marketing, public catalog poussé | Masquer ; ne pas déployer embeds |
| Commercial / billing | Polar, plans, upgrade triggers, AI packs | Masquer settings billing / upgrade |
| Multi-organisation | Org switcher « add org », multi-tenant cloud | Déjà limité en self-host ; cacher résidus UI |
| Automation exposée | Public API, Zapier, MCP tabs | Masquer nav automation |
| Domaines custom | Cloudflare custom domain | Masquer |
| Landing page marketing org | Theme picker landing | Masquer settings landing (sauf besoin interne) |
| Gamification complexe | Badges, points, leaderboards | N’existe pas vraiment — ne pas ajouter |
| Apps satellites | `website`, `docs` | Ne pas déployer |
| Cohorts (programmes) | `/cohorts` | Masquer V1 (réévaluer V1.1) |
| Attendance live class | Attendance | Hors besoin V1 — masquer si visible |
| SSO / token-auth | Enterprise licensed | Reporté |

### Principe de traitement

```
Masquer / désactiver  >  configurer  >  modifier  >  supprimer
```

**Ne pas supprimer** le code upstream des features exclus : cela compromet les merges.  
**Ne pas réécrire** courses, auth, certificates, roles.

---

## 6. Features à vraiment modifier (périmètre étroit)

Seules ces catégories justifient du code fork (après validation) :

1. **Navigation** — filtrer les entrées hors scope (`org-navigation.ts`, `lms-navigation.ts`).  
2. **Branding** — logos ClassroomIO → Celluloplast Academy ; titres ; favicon.  
3. **i18n FR métier** — libellés Formation / Module / Cours / Certificat (sans changer le schéma).  
4. **Defaults self-host** — community/exercises off, signup invite-only recommandé.  
5. **Settings UX** — masquer onglets billing, AI, landing, domains, automation.  
6. **(Optionnel)** Feature-flag module local `celluloplast` centralisant les masquages pour faciliter les merges.

Hors de cette liste : **pas de refonte**, pas de nouveau domaine métier, pas de nouveau rôle.

---

## 7. Features existantes = besoin (réutiliser)

| Besoin | Feature existante | Notes |
|--------|-------------------|-------|
| Utilisateurs | Audience + Teams + Invites | Suffisant V1 |
| Formations | Courses | Renommer en UI |
| Modules | Sections | Renommer en UI |
| Cours | Lessons | Renommer en UI |
| Assignation | People + Invite | OK |
| Progression | lessonCompletion + dash | OK |
| Certificats | certificates package | OK |
| Dashboard étudiant | `/lms` | OK |
| Dashboard formateur | `/org` + course people | OK (pas de dash tutor séparé à inventer) |
| Rôles | ADMIN/TUTOR/STUDENT | OK |

---

## 8. Hypothèses à valider avec le métier

1. **Assignation only** vs catalogue Explore : les employés voient-ils uniquement les formations assignées, ou un catalogue interne ?  
2. **Quiz** : requis dès V1 ou plus tard ?  
3. **Une formation = un certificat** suffit-il, ou faut-il certificats intermédiaires par module ? (le moteur actuel est plutôt *course-level*)  
4. **Tuteurs** : peuvent-ils créer n’importe quelle formation, ou seulement celles où ils sont « team » ? (comportement natif = team/cours)  
5. **Langue** : FR only, ou FR + EN ?  
6. **Auth** : email/password suffit-il, ou besoin SSO Microsoft/Google en V1.1 ?

---

## 9. Critères de succès V1

- Un admin peut créer une formation structurée (modules → cours) et assigner 10 employés.  
- Un apprenant se connecte, suit, termine, télécharge un certificat.  
- Un tuteur voit la progression de « ses » apprenants.  
- Aucune entrée UI IA / billing / communauté / marketplace visible.  
- Stack Docker up sur VPS ; backups Postgres + MinIO documentés.  
- Le dépôt reste mergeable avec upstream ClassroomIO.

---

## 10. Hors décision (volontairement ouvert)

- Intégration RH / SIRH  
- SCORM  
- Webhooks sortants  
- App mobile native  
- Parcours multi-formations type « programme annuel » (cohorts)

Ces sujets pourront alimenter une V1.1+ après usage réel.
