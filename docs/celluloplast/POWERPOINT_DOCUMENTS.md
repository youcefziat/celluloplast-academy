# Documents PowerPoint dans les leçons

## Supported Formats — formats pris en charge

Les documents de leçon acceptent `PDF`, `DOC`, `DOCX`, `PPT` et `PPTX`. Les fichiers PowerPoint sont convertis en PDF de façon asynchrone afin d'utiliser la visionneuse PDF.js déjà intégrée au dashboard. Le fichier PowerPoint d'origine reste disponible au téléchargement.

Les fichiers macro-enabled (`PPTM`, `PPSM`, etc.) ne sont pas acceptés.

## Upload Limits — limites d'upload

La limite par défaut des documents de leçon est un plafond strict de 50 Mo : un fichier doit faire **moins de 50 Mo**. Les limites des images, vidéos, documents de l'assistant et fichiers d'exercice sont indépendantes et ne changent pas.

## Conversion Architecture — architecture de conversion

1. Le navigateur demande une URL PUT présignée à l'API.
2. L'API vérifie la cohérence extension/MIME et refuse une taille annoncée supérieure ou égale à la limite.
3. Le navigateur envoie directement l'original dans le bucket `documents`.
4. Lors de l'enregistrement de l'asset de leçon, l'API contrôle avec `HeadObject` la taille et le MIME réellement stockés.
5. Pour un `PPT` ou `PPTX`, l'asset reçoit `metadata.documentProcessing.status = processing` et un job BullMQ `convert-document` est ajouté à la queue `media`.
6. Le worker télécharge l'original dans un répertoire temporaire, lance LibreOffice Impress en mode headless et téléverse le PDF sous `converted/<assetId>/document.pdf`.
7. Le worker passe le statut à `ready`, ou à `failed` après épuisement des tentatives.
8. À la lecture d'une leçon, l'API signe séparément l'original et le PDF dérivé. Le dashboard ouvre le PDF dans la visionneuse intégrée et conserve le bouton Télécharger sur l'original.

Les URL présignées ne sont jamais persistées. La leçon conserve uniquement la clé et l'identifiant de l'asset d'origine. La clé du PDF dérivé et son état appartiennent aux métadonnées de l'asset.

## Worker

La conversion utilise la queue BullMQ `media` et le job `convert-document`. Une ligne `media_job` et une étape idempotente permettent les tentatives, l'observabilité et le dead-lettering existants. La requête HTTP d'upload ne lance jamais LibreOffice.

## Object Storage — stockage objet

- Original : clé d'upload existante dans le bucket `documents`.
- PDF dérivé : `converted/<assetId>/document.pdf` dans le même bucket privé.
- La lecture génère deux URL signées distinctes ; aucune URL temporaire n'est écrite en base.
- La suppression de l'asset nettoie l'original et le préfixe dérivé.

## Student Viewer — visionneuse étudiant

La visionneuse PDF.js existante affiche le PDF original ou le PDF dérivé du PowerPoint. Elle conserve pagination, page courante, zoom, clavier et plein écran. Télécharger continue de cibler le PPT/PPTX original. Aucun suivi slide par slide n'est ajouté.

## Error Handling — gestion des erreurs

- `processing` : la présentation est en file ou en cours de conversion.
- `ready` : le PDF dérivé est disponible.
- `failed` : Redis est absent, l'enqueue échoue ou toutes les tentatives de conversion échouent ; l'original reste téléchargeable.

## Local Setup — installation locale

Le worker Docker installe `libreoffice-impress` avec `--no-install-recommends`, ainsi que les polices DejaVu et Liberation. Aucun nouveau service n'est requis : le worker BullMQ existant assure la conversion. Redis, PostgreSQL et l'accès au bucket `documents` restent obligatoires.

Pour une installation hors Docker, la commande `libreoffice` doit être accessible dans le `PATH` du worker. Les paramètres `--headless`, `--convert-to`, `--outdir` et le profil isolé `-env:UserInstallation=...` suivent la [documentation officielle des paramètres LibreOffice](https://help.libreoffice.org/latest/en-GB/text/shared/guide/start_parameters.html).

LibreOffice est distribué comme logiciel libre sous MPL 2.0, avec les informations complètes disponibles sur la [page officielle des licences](https://www.libreoffice.org/licenses/). L'image Docker ne copie ni ne modifie son code source ; elle installe le paquet Debian officiel et conserve les licences du paquet.

### Impact sur la taille de l'image

Mesuré avec `docker image inspect` sur la couche de base `node:20-bookworm-slim`, avant et après l'ajout de `libreoffice-impress` et des polices :

| Couche de base | Taille | Écart |
| --- | ---: | ---: |
| `ca-certificates` + `ffmpeg` (avant) | 247 Mo (235 Mio) | — |
| `ca-certificates` + `ffmpeg` + `libreoffice-impress` + polices (après) | 366 Mo (349 Mio) | **+119 Mo (+114 Mio)** |

L'image `jobs` complète construite depuis `docker/Dockerfile.jobs` pèse 1,05 Go (998 Mio). LibreOffice représente donc environ 11 % de l'image finale. Les chiffres dépendent des versions de paquets Debian ; les remesurer en CI après une mise à jour de la base.

### Validation en conteneur

Conversions réelles exécutées dans l'image `jobs` construite depuis `docker/Dockerfile.jobs`, avec les mêmes arguments que `apps/jobs/src/utils/libreoffice.ts` (profil isolé, macros désactivées), sous l'utilisateur non-root `node` (uid 1000) et LibreOffice 7.4.7.2 :

| Entrée | Taille source | PDF produit | Durée |
| --- | ---: | ---: | ---: |
| `fixture.pptx` | 12 Ko | 20,8 Ko | 2 s |
| `fixture-one.pptx` | 0,93 Mo | 20,8 Ko | 1 s |
| `fixture-ten.pptx` | 9,7 Mo | 20,8 Ko | 1 s |
| `fixture-forty.pptx` | 40,5 Mo | 20,8 Ko | 1 s |
| `fixture.ppt` (legacy) | 459 Ko | 20,6 Ko | 1 s |

Les PPTX de 1 à 40 Mo portent un binaire de bourrage stocké sans compression : le PDF exporté reste petit parce que seules les diapositives sont rendues. LibreOffice émet `failed to launch javaldx` faute de JRE dans l'image ; l'export PDF Impress n'a pas besoin de Java et les conversions aboutissent.

## Production Requirements — exigences de production

- Exécuter Redis et le worker `jobs` en permanence.
- Donner au worker un accès privé en lecture/écriture au bucket `documents`.
- Prévoir au moins 180 secondes par conversion et dimensionner la concurrence via `MEDIA_WORKER_CONCURRENCY`.
- Surveiller les jobs `convert-document`, les dead letters et l'espace temporaire du conteneur.
- Conserver la même valeur `UPLOAD_MAX_DOCUMENT_MB` sur l'API et le dashboard.

## Configuration

| Variable | Valeur par défaut | Rôle |
| --- | ---: | --- |
| `UPLOAD_MAX_DOCUMENT_MB` | `50` | Plafond strict des documents de leçon, partagé par l'API et le dashboard |
| `BODY_SIZE_LIMIT` | `943718400` | Limite adapter-node du dashboard ; les documents de leçon utilisent normalement le PUT direct vers le stockage |
| `REDIS_URL` | — | Queue BullMQ et worker |
| `OBJECT_STORAGE_BUCKET_DOCUMENTS` | `documents` | Originaux et PDF dérivés |
| `MEDIA_WORKER_CONCURRENCY` | `2` | Concurrence globale du worker media, conversions comprises |

Définir la même valeur `UPLOAD_MAX_DOCUMENT_MB` sur l'API et le dashboard. Les fichiers de composition du dépôt appliquent explicitement `50` aux deux services.

## Security — sécurité

- MIME PPTX : `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
- MIME PPT : `application/vnd.ms-powerpoint`.
- Les extensions macro-enabled (`.pptm`, `.ppsm`, etc.) sont refusées.
- L'extension du nom doit correspondre au MIME déclaré.
- L'API revalide le `Content-Length` et le `Content-Type` stockés avant de créer l'asset de leçon.
- LibreOffice est lancé via `execFile`, sans shell, avec délai maximal, profil temporaire isolé et sans privilèges root dans le conteneur.
- Le profil isolé force `MacroSecurityLevel=3` (« très élevé ») sans emplacement de confiance ; les macros du document sont donc désactivées.
- Le worker ne lance jamais une présentation ni un diaporama ; il appelle uniquement le filtre d'export PDF.
- Les répertoires temporaires sont supprimés après chaque tentative.
- L'original n'est pas écrasé. La suppression de l'asset nettoie aussi le préfixe PDF dérivé.

## États visibles

- `processing` : « Préparation du document... » ; l'action Voir n'ouvre aucun nouvel onglet.
- `ready` : Voir ouvre le PDF dérivé dans PDF.js, avec pagination, zoom, clavier et plein écran existants.
- `failed` : « La présentation PowerPoint n’a pas pu être préparée pour la lecture. » ; l'original reste téléchargeable.

Après conversion, un nouveau chargement de la leçon suffit : l'API relit les métadonnées de l'asset et régénère les URL signées.

## Diagnostic

### Le document reste en traitement

1. Vérifier que Redis répond et que le conteneur `jobs` est démarré.
2. Chercher le job `convert-document` et la ligne `media_job` associée.
3. Vérifier `libreoffice --version` dans le conteneur.
4. Vérifier l'accès du worker au bucket `documents` et la présence de l'original.

### La conversion échoue

Consulter les logs `convert-document-failed`, puis la colonne `error` du `media_job`. Les causes usuelles sont une présentation corrompue, une police absente, un délai dépassé ou un stockage indisponible. Une erreur de conversion ne supprime jamais l'original.

### L'upload est refusé

- `413` : taille stockée ou annoncée supérieure ou égale à la limite.
- `400` : extension et MIME incohérents, ou métadonnées du stockage incohérentes.
- `415` : format non accepté.

Ne pas augmenter `BODY_SIZE_LIMIT` pour corriger un échec du PUT direct vers MinIO/S3 : contrôler plutôt la réponse de l'URL présignée, le CORS et les limites propres au stockage ou au proxy placé devant celui-ci.
