# Analytics locales — obsolète depuis le 2026-08-31

Ce document décrivait le contournement du 404 `/ingest/e/` provoqué par l'initialisation de
PostHog sur une installation self-hosted.

**Le problème n'existe plus** : le nettoyage 2026-08 a supprimé les trois SDK d'analytics /
feedback SaaS du tableau de bord.

| Supprimé | Fichier |
|---|---|
| PostHog | `lib/utils/services/posthog` + dépendance `posthog-js` |
| Umami | `lib/utils/services/umami` |
| UserJot | `lib/utils/services/userjot` |
| Amorçage | `lib/utils/functions/appSetup.ts` (`setupAnalytics`, `setupCloudAnalytics`, `setupAnalyticsBasedOnLicense`) |

Le tableau de bord n'émet plus aucune requête vers un service d'analytics tiers. Les domaines
correspondants ont également été retirés de la liste CSP (`lib/utils/csp-domains.js`).

**Sentry est conservé** : auto-hébergeable, inerte tant que `PUBLIC_SENTRY_DSN` n'est pas défini.

> Contexte historique : `initUserJot()` était appelé **avant** la garde `PUBLIC_IS_SELFHOSTED`,
> et l'identité de l'utilisateur (e-mail inclus) était transmise à `cdn.userjot.com`.
> Voir `CLEANUP_AUDIT.md` § 2.2.
