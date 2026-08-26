# S04 — Audit du modèle pédagogique

> **Statut** : audit — aucun comportement métier modifié, aucune migration DB.
> **Objet** : établir ce que ClassroomIO fournit déjà avant de décider quoi construire en S05.

---

## Réponses rapides (A → J)

| #   | Question                                  | Réponse                                                                                        |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A   | Notion équivalente à Module ?             | **Oui** — table `course_section`, CRUD complet                                                 |
| B   | Plusieurs modules par formation ?         | **Oui**, ordonnés par `order`                                                                  |
| C   | Comment une leçon est terminée ?          | Ligne dans `lesson_completion` (manuel) ou seuil de visionnage vidéo                           |
| D   | Progression calculée ou stockée ?         | **Calculée à la volée**, jamais persistée                                                      |
| E   | Complétion de module ?                    | **N'existe pas** — un compteur « 3/5 » est calculé côté client, sans jalon ni date             |
| F   | Génération du certificat ?                | Seuil de progression + échéance + exercice final optionnel → `groupmember.certificateEarnedAt` |
| G   | Automatique après complétion ?            | **Oui** — évalué après chaque leçon, vidéo et soumission                                       |
| H   | Plusieurs certificats par formation ?     | **Non** en générique · **Oui** en COMPLIANCE (cycles)                                          |
| I   | Certificat en fin de module ?             | **Non** — tout est au niveau formation                                                         |
| J   | SELF_PACED dans les APIs de progression ? | **Oui partout**, sauf `/dash/compliance-overview`                                              |

---

# Existing ClassroomIO Model

ClassroomIO couvre déjà la quasi-totalité du besoin Celluloplast, à une exception près : **le module n'est qu'un conteneur d'affichage**, jamais une unité de complétion.

Il existe **deux mécanismes de certification en parallèle** :

|                              | Chemin générique                                        | Chemin COMPLIANCE                                        |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| S'applique à                 | Tous les types de formation                             | `course.type = 'COMPLIANCE'` uniquement                  |
| Trace de complétion          | `groupmember.certificate_earned_at` (un seul timestamp) | `course_completion_record` (un enregistrement par cycle) |
| Entité certificat            | **aucune**                                              | `course_certificate_issue`                               |
| Historique / recertification | non                                                     | oui (cycles, `valid_until`, expiration)                  |
| Déclencheur                  | leçon terminée, vidéo terminée, exercice soumis         | **soumission d'exercice uniquement**                     |
| Fichier PDF                  | rendu à la demande, non stocké                          | champ `file_url` prévu                                   |

**Conséquence directe pour Celluloplast** : puisque nous refusons d'imposer le type `COMPLIANCE`, nos formations utiliseront le chemin générique — qui fonctionne, mais ne conserve **qu'une seule date de certification par (apprenant, formation)** et **aucune entité certificat**.

---

# Database Model

Toutes les tables sont dans `packages/db/src/schema.ts`.

| Table                      | Rôle                      | Colonnes clés                                                                                          |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `course`                   | **Formation**             | `title`, `type`, `status`, `group_id`, `metadata` (jsonb), `certificate` (jsonb), `compliance` (jsonb) |
| `course_section`           | **Module**                | `id`, `title`, `order`, `course_id`                                                                    |
| `lesson`                   | **Cours**                 | `id`, `title`, `order`, `course_id`, `section_id`, `completion_policy`, `video_watch_threshold`        |
| `exercise`                 | Quiz / exercice           | `course_id` **ou** `lesson_id`                                                                         |
| `group` + `groupmember`    | **Affectation**           | `groupmember.role_id` (1/2/3), `profile_id`, `certificate_earned_at`, `certification_email_sent_at`    |
| `lesson_completion`        | **Complétion d'un cours** | `lesson_id`, `profile_id`, `is_complete` — unique `(lesson_id, profile_id)`                            |
| `lesson_video_progress`    | Suivi de visionnage       | alimente la complétion automatique                                                                     |
| `submission`               | Réponse à un exercice     | sert au calcul « exercice complété »                                                                   |
| `course_completion_record` | Cycle de conformité       | `cycle_number`, `status`, `due_date` (**NOT NULL**), `completed_at`, `valid_until`                     |
| `course_certificate_issue` | Certificat émis           | `course_completion_record_id` (**NOT NULL, unique**), `issued_at`, `expires_at`, `status`, `file_url`  |

**Il n'existe aucune table `section_completion` / `module_completion`.** Vérification : dans `getCourseContentItems`, les lignes de type `section` renvoient littéralement `NULL::boolean AS "isComplete"` — le module n'a pas d'état de complétion dans le modèle.

---

# Formation Model

- **Formation = `course`**, rattachée à l'organisation via `group.organization_id`.
- Types : `SELF_PACED` (défaut), `LIVE_CLASS`, `COMPLIANCE`, `PUBLIC`.
- Réglages utiles portés par `course.metadata` :
  - `isContentGroupingEnabled` — active le regroupement en modules (défaut : `true`)
  - `progressionMode` — `'free'` ou `'sequential'`
- Réglages de certification portés par `course.certificate` (jsonb) :
  - `threshold` — pourcentage requis (**défaut 100**)
  - `deadline` — date limite
  - `requiredExerciseId` + `exerciseMinScorePercent` — exercice final obligatoire
  - `isDownloadable`, `design`, `emailMessage`

**Affectation d'un employé** = une ligne `groupmember(group_id, profile_id, role_id = 3)`.

---

# Module Model

**Existe et est complet côté structure.**

- Table `course_section` : `title`, `order`, `course_id`.
- API : `apps/api/src/routes/course/section.ts` → `POST /`, `POST /promote-ungrouped`, `PUT /:sectionId`, `DELETE /:sectionId`, réordonnancement.
- Service : `packages/core/src/services/course/section.ts`.
- Rattachement : `lesson.section_id` → `course_section.id` (`ON DELETE CASCADE`).
- UI : arbre de contenu (`course-content-tree.svelte`), version mobile, éditeur de cours.

**Ce que le module n'a pas** : aucun état, aucune date de complétion, aucun jalon, aucun déverrouillage au niveau module. Le mode `sequential` déverrouille **élément par élément** sur la liste aplatie (`computeProgressionAccess`), pas module par module.

**Ce qui existe déjà côté affichage** : `getContentItemsProgress(items)` (`features/course/utils/content.ts`) renvoie `{ lessonsTotal, lessonsComplete, exercisesTotal, exercisesComplete, total, completed, percent }` pour **n'importe quel ensemble d'éléments** — donc pour un module. C'est déjà appelé par l'arbre de contenu, qui affiche « 3/5 » via `formatSectionCompletionLabel`.

> **La progression par module est donc déjà calculable exactement, sans nouvelle donnée.** Ce qui manque, c'est de l'exposer comme un concept (pourcentage, date d'achèvement, jalon) plutôt que comme une étiquette dans un arbre.

---

# Lesson Completion

Deux chemins, tous deux aboutissant à une ligne `lesson_completion` :

1. **Manuel** — `PUT /course/:courseId/lesson/:lessonId/completion` avec `{ isComplete }`
   → `assertEnrolledStudentContentAccess` (respecte `progressionMode`)
   → `upsertLessonCompletionService`
   → si `isComplete` : `evaluateCourseCertification(courseId, userId)` en tâche de fond.

2. **Automatique (vidéo)** — `PUT /:lessonId/watch-progress`
   → au franchissement de `lesson.video_watch_threshold` (95 % par défaut), `didJustComplete` déclenche la même évaluation de certification.

`lesson.completion_policy` (`'manual'` par défaut) arbitre entre les deux.

**Exercices** : la complétion dérive des `submission` (et, selon `completionPolicy` de l'exercice, d'un score minimal). Une soumission déclenche aussi `evaluateCourseCertification`.

---

# Progress Calculation

**Tout est calculé à la volée. Rien n'est persisté.**

### Côté serveur

```
calcCourseProgressPercent = (leçonsTerminées + exercicesTerminés)
                          / (totalLeçons   + totalExercices) × 100
```

`apps/api/src/utils/course-completion.ts` — alimenté par `getCourseProgress(courseId, profileId)`
(`packages/db/src/queries/course/course.ts`), **sans aucun filtre sur `course.type`**.

### Endpoints de progression existants

| Endpoint                                       | Portée                            | Contenu                                                                         | Type-agnostique                               |
| ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `GET /course/:id/certification-evaluation`     | 1 apprenant × 1 formation         | `progressPercent`, seuil, éligibilité, blocages                                 | **oui**                                       |
| `GET /course/:id/analytics`                    | 1 formation × tous les apprenants | `progressPercentage` par apprenant, exercices, note moyenne, dernière connexion | **oui**                                       |
| `GET /organization/audience/:userId/analytics` | 1 employé × toutes ses formations | `progress_percentage` par formation + `overallCourseProgress`                   | **oui**                                       |
| `GET /course/enrolled` (`TStudentCourse`)      | apprenant connecté                | `progressRate`, `exercisesCompleted`, `certificateEarnedAt`                     | **oui**                                       |
| `GET /dash/stats`                              | organisation                      | 5 formations max, taux agrégés                                                  | oui, mais **plafonné à 5**                    |
| `GET /dash/compliance-overview`                | organisation × apprenant          | statuts détaillés                                                               | **non — `course.type = 'COMPLIANCE'` en dur** |

### Côté client

`getContentItemsProgress(items)` — même formule, applicable à une formation entière **ou à un module**.

> **Réponse à J** : les formations `SELF_PACED` remontent dans **toutes** les APIs de progression. Le seul endroit qui les exclut est `/dash/compliance-overview`, via `eq(schema.course.type, 'COMPLIANCE')` dans `getOrgComplianceLearnerRows`. C'est précisément la page branchée sur « Progression » au sprint S03 — à remplacer.

---

# Certificate Model

### Conditions de génération (`buildCertificationEvaluation`)

Un certificat est acquis quand **toutes** ces conditions sont vraies :

1. l'utilisateur est membre de la formation (`groupMemberId` non nul) ;
2. `progressPercent >= certificate.threshold` (défaut **100 %**) ;
3. la formation a du contenu (`totalLeçons + totalExercices > 0`) ;
4. `certificate.deadline` n'est pas dépassée (si définie) ;
5. la règle d'exercice final est satisfaite (si `requiredExerciseId` défini) ;
6. l'organisation a les certificats activés (toujours vrai en self-hosted).

Blocages remontés à l'UI : `CERT_PROGRESS`, `CERT_DEADLINE_PASSED`, `CERT_NO_CONTENT`, `CERT_FINAL_EXERCISE_*`.

### Effet de bord à la première éligibilité

`claimMemberCertificateEarned(groupMemberId, earnedAt)` — écriture **atomique** conditionnée à `certificate_earned_at IS NULL`, donc idempotente. Puis : email de complétion, invalidation du cache de stats, événements analytics.

### Rendu du document

`POST /course/:courseId/download/certificate` (et `/png`)
→ `assertCertificateDownloadAllowed` (re-vérifie l'éligibilité)
→ `assembleCertificateRender` → `renderCertificate(design, data)` (`packages/certificates`) → PDF via Cloudflare.

**Le PDF n'est jamais stocké.** Le numéro de certificat est reconstruit à chaque téléchargement à partir de `design.idFormat` + `studentId` + date. `recipientName` et `issuedAt` sont fournis **par le client** (l'UI envoie `certificateEarnedAt`, donc la date reste stable — mais rien ne le garantit côté serveur).

### Relation certificat ↔ utilisateur ↔ formation

```
groupmember (group_id → course.group_id, profile_id)
  └── certificate_earned_at : timestamp | NULL
```

C'est **toute** la relation dans le chemin générique : un booléen daté porté par l'inscription. Pas d'entité, pas de numéro persisté, pas d'historique, pas de révocation.

---

# Gaps

| #   | Manque                                                   | Catégorie                       | Pourquoi                                                                                                                                                                         |
| --- | -------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Complétion de module comme jalon                         | **MISSING**                     | Aucun état ni date au niveau `course_section`. Le « 3/5 » de l'arbre est un calcul d'affichage, non exposé en API, non consultable par un formateur.                             |
| G2  | Certificat de fin de module                              | **MISSING**                     | Le moteur est entièrement course-level (`course.certificate`, `groupmember.certificate_earned_at`).                                                                              |
| G3  | Vue organisation de la progression, indépendante du type | **MISSING** (briques présentes) | `/dash/compliance-overview` filtre sur `COMPLIANCE` ; `/dash/stats` est plafonné à 5. Les briques par formation et par employé existent, l'agrégation organisation n'existe pas. |
| G4  | Preuve de certification durable                          | **ADAPT**                       | Un seul timestamp : pas de numéro persisté, pas de PDF archivé, pas d'historique. Suffisant pour la V1, insuffisant si un audit externe l'exige.                                 |
| G5  | Page `/org/{slug}/certifications` (S03)                  | **ADAPT**                       | Branchée sur `dash/stats`, donc plafonnée à 5 formations et 5 certifications. Provisoire, comme annoncé en S03.                                                                  |
| G6  | Nav « Progression » → `/compliance` (S03)                | **ADAPT**                       | Ne montrera rien pour des formations `SELF_PACED`. À rebrancher sur G3.                                                                                                          |

### Classement du périmètre demandé

| #   | Besoin                                   | Verdict     | Détail                                    |
| --- | ---------------------------------------- | ----------- | ----------------------------------------- |
| 1   | Formation                                | **EXISTS**  | `course`                                  |
| 2   | Module / section                         | **EXISTS**  | `course_section` + CRUD + UI              |
| 3   | Cours / leçon                            | **EXISTS**  | `lesson.section_id`                       |
| 4   | Enrollment / affectation                 | **EXISTS**  | `groupmember` + invitations               |
| 5   | Complétion d'une leçon                   | **EXISTS**  | `lesson_completion`                       |
| 6   | Complétion d'un module                   | **MISSING** | dérivable, mais inexistante comme concept |
| 7   | Progression d'une formation              | **EXISTS**  | calculée, type-agnostique                 |
| 8   | Certificat                               | **EXISTS**  | course-level, seuil configurable          |
| 9   | Relation certificat ↔ user ↔ formation | **ADAPT**   | un timestamp, sans entité                 |
| 10  | Conditions de génération                 | **EXISTS**  | seuil + échéance + exercice final         |

---

# Proposed Celluloplast Model

Trois principes pour rester simple :

1. **La complétion d'un module est dérivée, pas stockée.** Un module est terminé quand tous ses cours et exercices le sont ; la date d'achèvement est le `MAX(lesson_completion.updated_at)` du module. Zéro migration, zéro risque de désynchronisation, zéro rattrapage sur les données existantes.
2. **Le seuil reste le mécanisme de certification.** `certificate.threshold` existe et fonctionne pour tous les types : un jalon « formation terminée » est `threshold = 100`, un jalon plus souple est `threshold = 80`. Rien à construire.
3. **Un certificat par formation et par employé** en V1. C'est le besoin exprimé. La recertification par cycles reste disponible plus tard via le chemin COMPLIANCE, sans travail supplémentaire.

### Ce que cela implique

| Besoin métier                      | Réponse                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Suivre ses formations              | `GET /course/enrolled` — existe                                                 |
| Terminer des cours                 | `PUT /lesson/:id/completion` — existe                                           |
| Voir sa progression **par module** | **à exposer** : `getContentItemsProgress` par section, déjà calculé côté client |
| Voir sa progression globale        | existe (`progressRate` / `certification-evaluation`)                            |
| Certificat à un jalon              | existe via `threshold`                                                          |
| Suivi organisation par un admin    | **à construire** : agrégation type-agnostique (G3)                              |

### Sur le certificat de module

À ne **pas** implémenter tant que le métier ne l'a pas confirmé. Le jour venu, l'option minimale est une table fork dédiée :

```
celluloplast_module_certificate (profile_id, section_id, issued_at)
```

Une table fork isolée, plutôt que de généraliser `course_certificate_issue` — qui exige un `course_completion_record` avec un `due_date NOT NULL`, notion propre à la conformité. Généraliser ces deux tables upstream serait le chemin le plus coûteux en rebase et le plus éloigné de notre besoin.

---

# Database Changes Required

**Aucune pour S05.**

Le modèle cible se construit intégralement sur `course`, `course_section`, `lesson`, `lesson_completion`, `groupmember` et `course.certificate`.

Migrations à envisager **plus tard, et seulement sur validation métier** :

| Déclencheur                 | Migration                                                           | Coût                                   |
| --------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Certificat de fin de module | `celluloplast_module_certificate` (table fork)                      | faible, isolée                         |
| Preuve d'audit durable      | numéro de certificat + URL PDF persistés                            | moyen                                  |
| Recertification annuelle    | généraliser `course_completion_record` (rendre `due_date` nullable) | élevé — modifie la sémantique upstream |

---

# API Changes Required

### 1. Progression par module — `ADAPT`, aucune donnée nouvelle

Exposer la progression par section dans la réponse contenu déjà servie. `getCourseContentItems(courseId, profileId)` renvoie déjà l'`isComplete` par élément et les sections ; il suffit d'agréger par `section_id`.

- `packages/db/src/queries/course/content.ts` — la donnée est déjà là
- `packages/core/src/services/course/…` — agrégation
- Alternative sans toucher au serveur : agréger côté client avec `getContentItemsProgress`, déjà écrit

### 2. Progression organisation type-agnostique — `MISSING`, le vrai chantier de S05

Nouvel endpoint, calqué sur `getOrgComplianceOverview` **sans le filtre de type** :

```
GET /dash/learning-overview?orgId=…   (orgMemberMiddleware → admin + tuteur)
→ { learners: [{ profileId, fullname, courseId, courseTitle,
                 progressPercent, lessonsCompleted, lessonsTotal,
                 certificateEarnedAt }],
    courses:  [{ courseId, title, learnerCount, avgProgress, certifiedCount }] }
```

- `packages/db/src/queries/dash/` — une requête, sans `eq(course.type, 'COMPLIANCE')`
- `apps/api/src/services/dash.ts` + `apps/api/src/routes/dash/stats.ts`
- Middleware `orgMemberMiddleware` (et non `orgAdminMiddleware`) pour que les tuteurs y accèdent

**Attention performance** : ne pas reproduire le motif `Promise.all` par apprenant de `getCourseAnalytics` (une requête par apprenant). Une seule requête agrégée, sur le modèle de `getOrgComplianceLearnerRows`.

### 3. Certifications organisation — `ADAPT`

Remplacer la source `dash/stats` (plafond 5) de la page S03 par la même requête que le point 2, filtrée sur `certificate_earned_at IS NOT NULL`.

---

# UI Changes Required

| Écran                               | Changement                                                                      | Priorité  |
| ----------------------------------- | ------------------------------------------------------------------------------- | --------- |
| Lecteur de cours (apprenant)        | Afficher un pourcentage par module, pas seulement « 3/5 »                       | haute     |
| `/lms/mylearning`                   | Détail par module sous chaque formation                                         | moyenne   |
| `/org/{slug}/progression` (nouveau) | Remplace le renvoi vers `/compliance` : tableau employé × formation, tous types | **haute** |
| `/org/{slug}/certifications`        | Rebrancher sur le nouvel endpoint, supprimer le plafond de 5                    | haute     |
| `lib/celluloplast/navigation.ts`    | Rediriger « Progression » vers la nouvelle route                                | haute     |
| Éditeur de formation                | Rendre `certificate.threshold` explicite (« certificat à X % »)                 | moyenne   |

Toutes les modifications de navigation passent par la couche fork `lib/celluloplast/*` mise en place en S03 — inchangée par ce sprint.

---

# Recommended Implementation Order

| Étape                               | Contenu                                                                                             | DB           | Risque |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------ | ------ |
| **S05.1**                           | Endpoint `learning-overview` type-agnostique + page `/org/{slug}/progression`                       | aucune       | faible |
| **S05.2**                           | Rebrancher « Progression » et « Certifications » (supprimer le plafond de 5, quitter `/compliance`) | aucune       | faible |
| **S05.3**                           | Progression par module exposée à l'apprenant                                                        | aucune       | faible |
| **S05.4**                           | Rendre le seuil de certification lisible dans l'éditeur de formation                                | aucune       | faible |
| **S06** _(si validé)_               | Certificat de fin de module                                                                         | 1 table fork | moyen  |
| **S07** _(si audit externe requis)_ | Numéro de certificat et PDF archivés                                                                | migration    | moyen  |

**S05 ne demande aucune migration.** C'est le point le plus important de cet audit : le besoin Celluloplast est couvert par le modèle existant, à une agrégation près.

---

## Modèle cible

```
Formation                          = course
  -> Module                        = course_section
      -> Cours                     = lesson (section_id)
      -> Completion                = DÉRIVÉE : tous les lesson_completion du module
  -> Module
      -> Cours
      -> Completion
  -> Progression globale           = CALCULÉE : (leçons + exercices terminés) / total
  -> Certification(s)              = groupmember.certificate_earned_at
                                     déclenchée quand progression >= course.certificate.threshold
```

Aucun élément de ce schéma n'exige une table nouvelle : deux sont dérivés, un est calculé, les trois autres existent.

---

## Points à trancher avec le métier avant S05

1. **Seuil de certification** : 100 % (défaut actuel) ou plus souple, par exemple 80 % ?
2. **Certificat de module** : besoin réel, ou la progression par module suffit-elle à l'affichage ?
3. **Exercices/quiz** : le jalon « quiz réussi » est-il attendu en V1 ? Le moteur existe (`requiredExerciseId` + `exerciseMinScorePercent`), il suffit de le configurer.
4. **Recertification** : une formation doit-elle être refaite périodiquement ? Si oui, c'est la seule raison de rouvrir le chemin COMPLIANCE.
5. **Preuve d'audit** : un numéro de certificat opposable et un PDF archivé sont-ils exigés ?
