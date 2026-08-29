# Éditeur visuel de certificats

## Objectif

L’éditeur d’entreprise situé sur `/org/{slug}/settings/certificates` est un éditeur WYSIWYG de document, et non plus un formulaire de configuration de thème. L’ADMIN compose un certificat paysage en déplaçant et redimensionnant des objets. Le TUTOR peut consulter le rendu exact en lecture seule. Le STUDENT n’a pas accès à cette page.

Le document enregistré est la source unique du rendu dans le dashboard, du PNG et du PDF téléchargé. Les anciens renderers restent uniquement disponibles pour lire les objets historiques qui n’ont pas encore été migrés.

## Architecture retenue

L’éditeur utilise des éléments DOM positionnés en absolu et les Pointer Events natifs du navigateur. Le canevas logique mesure `1100 × 780 px`, soit un rapport paysage proche de l’A4. Il est mis à l’échelle visuellement pour tenir dans la zone disponible; les coordonnées persistées restent toujours exprimées dans le repère `1100 × 780`.

Ce choix évite d’introduire une deuxième pile de rendu canvas. Les textes restent du vrai texte DOM, les polices CSS sont identiques à celles du document PDF, et la sérialisation ne dépend d’aucune bibliothèque tierce. Les interactions couvertes sont le déplacement, le redimensionnement sur huit poignées, la sélection, la duplication, l’ordre des calques, les alignements, le copier/coller et l’historique annuler/rétablir.

Les responsabilités sont séparées ainsi :

- `packages/certificates` contient le schéma TypeScript canonique, les presets, la migration, les variables et le renderer HTML/CSS partagé;
- `packages/utils` valide le document reçu par l’API avec Zod;
- `apps/dashboard/src/lib/features/certificate-designer` contient l’état Svelte 5, les interactions et l’interface;
- `apps/api/src/utils/certificate.ts` migre la valeur stockée avant tout rendu;
- `apps/api/src/services/course/certificate.ts` charge les vraies données de l’apprenant, de la formation et de l’organisation;
- Cloudflare Browser Rendering transforme le même HTML/CSS en PNG ou PDF.

## Schéma de sérialisation V1

La configuration est enregistrée sous `organization.settings.certificateDesign`.

```json
{
  "version": 1,
  "page": {
    "width": 1100,
    "height": 780,
    "backgroundColor": "#faf6ec",
    "backgroundImageUrl": "https://cdn.example.com/background.png",
    "backgroundImageOpacity": 1
  },
  "elements": [
    {
      "id": "student-name",
      "name": "Nom complet",
      "type": "variable",
      "variable": "student.fullName",
      "x": 200,
      "y": 270,
      "width": 700,
      "height": 70,
      "rotation": 0,
      "opacity": 1,
      "zIndex": 2,
      "fontFamily": "cormorant-garamond",
      "fontSize": 48,
      "fontWeight": 600,
      "fontStyle": "normal",
      "textAlign": "center",
      "color": "#111827",
      "lineHeight": 1.2
    }
  ],
  "certificateIdFormat": "CERT-{year}-{seq}",
  "sourcePresetId": "classique"
}
```

`version` est obligatoire. Une future évolution incompatible doit créer une nouvelle version et une fonction de migration explicite; elle ne doit pas modifier silencieusement la signification des champs V1.

## Types d’éléments

Tous les éléments possèdent `id`, `name`, `x`, `y`, `width`, `height`, `rotation`, `opacity`, `zIndex` et éventuellement `locked`.

- `text` stocke un contenu libre ainsi que sa police, taille, graisse, style, alignement, couleur et hauteur de ligne;
- `variable` possède les mêmes propriétés typographiques, mais référence une variable métier centralisée au lieu de stocker la valeur affichée;
- `image` référence une URL et un rôle `logo`, `signature` ou `image`; `objectFit` et `keepRatio` contrôlent son redimensionnement;
- le fond est une propriété de `page`, pas un élément. Il reste toujours derrière les calques et n’est pas sélectionnable sur le canevas.

Les groupes d’objets ne font pas partie de la V1.

## Variables dynamiques

Les identifiants supportés sont centralisés dans `packages/certificates/src/types.ts` et résolus par `packages/certificates/src/variables.ts` :

| Variable | Source de production |
|---|---|
| `student.fullName` | profil de l’apprenant, avec repli sur le nom de la requête |
| `student.firstName` | prénom dérivé du profil |
| `student.lastName` | nom dérivé du profil |
| `student.email` | e-mail du profil |
| `course.name` | titre courant de la formation |
| `course.description` | description courante de la formation |
| `certificate.date` | date d’émission ou de complétion |
| `certificate.id` | identifiant construit avec `certificateIdFormat` |
| `organization.name` | nom courant de l’organisation |

La prévisualisation de l’éditeur utilise volontairement un contexte stable : Ahmed Benali, `ahmed.benali@celluloplast.com`, Sensibilisation Cybersécurité, 29/08/2026 et Celluloplast. Une variable inconnue produit une chaîne vide et un avertissement; elle ne doit jamais casser la génération du document.

## Presets et bibliothèque d’édition

Les cinq anciens thèmes — Classique, Brutalist, Noir, Poster et Minimal — sont désormais produits par `createCertificateLayoutPreset`. Chaque preset retourne un document V1 composé d’éléments éditables. Le changement de preset remplace les éléments structurants connus, tout en conservant les calques ajoutés par l’utilisateur tels que logos, signatures, images et textes personnalisés.

Aucune dépendance d’édition visuelle n’a été ajoutée. Fabric.js et Konva sont adaptés aux scènes canvas et apportent leur propre modèle de rendu; Moveable et interact.js couvrent les interactions DOM mais ajouteraient une dépendance pour un ensemble limité d’opérations. Les Pointer Events natifs suffisent au périmètre V1 et maintiennent un seul modèle de rendu DOM/PDF.

## Stockage et sauvegarde

Le bouton Enregistrer envoie le document complet dans `settings.certificateDesign` via l’API d’organisation existante. La validation limite notamment le document à 100 éléments, borne les dimensions, l’opacité et les z-index, et n’accepte que des URLs d’images valides. Les images sont téléversées par le flux média existant vers S3/MinIO; aucun binaire ni data URL n’est stocké dans le JSON.

L’éditeur conserve jusqu’à 50 états locaux pour annuler/rétablir. Quitter la page avec des changements non enregistrés déclenche la garde de navigation commune. Réinitialiser restaure le preset Celluloplast par défaut, mais la réinitialisation ne devient permanente qu’après Enregistrer.

## Migration des configurations historiques

`migrateLegacyCertificateDesign` accepte :

- un document V1, retourné sans perte après clonage;
- l’ancien objet `CertificateDesign` avec `templateId`, `accentColor`, `subtitle`, `descriptionOverride`, `logoUrl`, `signatories` et `idFormat`;
- l’ancien conteneur de cours `{ design?, theme? }`;
- une valeur absente ou invalide, transformée en preset Classique par défaut.

La migration convertit le thème en preset, applique la couleur, crée des objets éditables pour le sous-titre, la description, le logo, les signatures et les signataires, puis conserve le format d’identifiant. La migration est effectuée au chargement de l’éditeur et avant chaque rendu API. Le premier enregistrement remplace naturellement l’ancien objet par le document V1.

## Prévisualisation et rendu PDF

Le mode Prévisualisation appelle `renderCertificateDocument`, le même renderer partagé que l’API. Les positions, dimensions, rotations, opacités, z-index, polices, couleurs, retours à la ligne, images et fond sont donc générés à partir du même JSON.

Le PDF et le PNG suivent le flux suivant :

1. le service charge le document d’organisation, la formation, l’organisation et le profil apprenant;
2. le document historique éventuel est migré en V1;
3. les variables sont résolues avec les données réelles;
4. `renderCertificate` produit le HTML et le CSS absolus;
5. Cloudflare Browser Rendering produit le PDF ou le PNG.

Le CSS déclare une page sans marge de `1100 × 780 px`. Le fond est rendu séparément avec `object-fit: cover`; les images de contenu respectent leur propre `objectFit`.

## Permissions

- ADMIN : accès complet à l’éditeur et à la sauvegarde;
- TUTOR : prévisualisation en lecture seule;
- STUDENT : aucune entrée de navigation ni accès à la page de paramètres;
- API : l’écriture reste protégée par le middleware administrateur de l’organisation.

Les contrôles côté interface ne remplacent jamais l’autorisation de l’API.

## Tests

Les tests ciblés se lancent avec :

```powershell
pnpm --filter @cio/certificates test
```

Ils vérifient les cinq presets V1, la migration des anciens champs, la résolution des variables, la conservation des coordonnées dans le HTML et le comportement sûr d’une variable inconnue.

Pour une recette visuelle complète, suivre la section dédiée de `docs/celluloplast/LOCAL_TEST_GUIDE.md`. La comparaison doit être faite entre le canevas, le mode Prévisualisation puis le PDF téléchargé avec un logo, une signature, un fond importé et plusieurs champs dynamiques.

## Limites connues de la V1

- édition desktop uniquement;
- sélection simple, sans multi-sélection ni groupes;
- pas de rotation interactive, de repères magnétiques ou de grille d’alignement;
- pas de formes vectorielles ni de filtres d’image;
- pas de recadrage interne d’image, uniquement `contain` ou `cover`;
- les polices Google nécessitent un accès réseau au moment du rendu;
- le PDF de bout en bout nécessite des identifiants Cloudflare Browser Rendering valides.
