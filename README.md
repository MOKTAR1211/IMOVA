# Immo229

## Prérequis et installation
- **Node.js** ≥ 20.19 et **npm**
- **PostgreSQL** pour les environnements persistants
- Git, si vous récupérez le projet depuis un dépôt

Le backend est une API Express dont le point d'entrée est `backend/server.js`. Il utilise PostgreSQL via `pg`. En développement seulement, si PostgreSQL est inaccessible, un fallback en mémoire fondé sur `pg-mem` est utilisé ; il ne conserve pas les données après l'arrêt du processus. Le projet n'utilise ni Prisma ni SQLite.

Depuis le dossier du projet, installez les dépendances :

```powershell
npm ci
npm ci --prefix backend
```

Si aucun fichier `package-lock.json` n'est disponible dans l'un des dossiers, remplacez `npm ci` par `npm install`.

## Base de données PostgreSQL
Créez une base et un utilisateur PostgreSQL dédiés à l'application. Appliquez ensuite le schéma initial depuis la racine du projet :

```powershell
psql -h localhost -U postgres -d immo229 -f backend/schema.sql
```

Le compte utilisé par l'application doit pouvoir lire et modifier les tables et séquences de cette base. Au démarrage, le backend ajoute aussi les tables et colonnes liées aux paiements et à la réinitialisation du mot de passe.

## Variables d'environnement
Copiez le modèle vers le fichier local du backend :

```powershell
Copy-Item backend\.env.example backend\.env
```

Renseignez `backend\.env` en développement, ou les variables d'environnement protégées de l'hébergeur en production :

- `PORT` – port HTTP de l'API (5000 par défaut)
- `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT` – accès PostgreSQL
- `JWT_SECRET` – secret aléatoire ; en production, 32 caractères minimum
- `FRONTEND_URL` – origine autorisée par CORS ; en production, URL publique HTTPS du frontend
- `VITE_API_URL` – URL de l'API au moment du build du frontend (ex. `https://api.votre-domaine.bj`)
- `MTN_MOMO_API_BASE_URL`, `MTN_MOMO_TARGET_ENVIRONMENT`, `MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY` – configuration privée de l'API MTN MoMo Collection fournie au compte marchand
- `MTN_MOMO_COUNTRY_CODE`, `MTN_MOMO_CURRENCY` – pays et devise (Bénin : `229`, `XOF`)
- `BACKEND_PUBLIC_URL` – URL publique HTTPS de l'API en production
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` – transport obligatoire pour la confirmation des comptes et la réinitialisation du mot de passe
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` – optionnels, si les photos doivent être stockées dans Cloudinary

Générez un secret JWT, par exemple avec Node.js :

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`backend\.env` est ignoré par Git ; ne commitez et ne partagez jamais de secrets.

### Configuration Gmail / Google Workspace sur le VPS
Le modèle `deploy/backend.production.env.example` est préconfiguré pour Gmail sur `smtp.gmail.com:587` avec STARTTLS (`SMTP_SECURE=false`). Avant le déploiement :

1. Activez la validation en deux étapes sur le compte Google, puis créez un mot de passe d'application pour l'API. Utilisez ce mot de passe d'application (et non le mot de passe habituel du compte) dans `SMTP_PASSWORD`.
2. Dans `backend/.env` sur le VPS, renseignez `SMTP_USER` avec le compte Google, `SMTP_PASSWORD` avec le mot de passe d'application et `SMTP_FROM` avec ce même compte ou une adresse d'expéditeur autorisée dans Google Workspace.
3. Protégez le fichier : `chmod 600 backend/.env`. Ne transmettez jamais le mot de passe d'application dans le chat et ne le commitez pas.
4. Le script de déploiement contrôle la présence de la configuration SMTP, et l'API de production refuse de démarrer si elle est incomplète. Après configuration, lancez `bash deploy/deploy.sh`, puis testez une vraie inscription et la réception du code (y compris les courriers indésirables).

Les comptes Google Workspace gérés peuvent interdire les mots de passe d'application. Dans ce cas, demandez à l'administrateur Workspace d'autoriser l'envoi SMTP ou choisissez un relais SMTP approuvé, puis adaptez les paramètres du fournisseur. Gmail peut aussi imposer des limites d'envoi : pour un volume d'inscription important, utilisez un fournisseur transactionnel dédié.

En production, définissez `NODE_ENV=production`. L'API refuse de démarrer si le secret JWT est absent ou faible, si les URL frontend/API ne sont pas en HTTPS public, si les variables SMTP requises sont absentes ou si PostgreSQL est indisponible. Le fallback mémoire et les données de démonstration sont désactivés en production.

## Gestion des comptes et récupération de mot de passe
Après l'inscription, un code à 6 chiffres est envoyé à l'adresse e-mail fournie. Il expire après 10 minutes, ne peut être utilisé qu'une fois et le nombre d'essais est limité. La connexion est refusée tant que l'adresse n'est pas confirmée. Configurez SMTP avant d'ouvrir les inscriptions en production ; sans SMTP, l'API refuse de créer de nouveaux comptes. Un utilisateur non confirmé peut demander le renvoi du code après une minute.

L'administration peut suspendre ou réactiver les comptes client et propriétaire. Un compte suspendu ne peut plus se connecter et les jetons déjà émis sont refusés par l'API et Socket.IO. Les comptes administrateurs et le compte de l'administrateur connecté ne peuvent pas être suspendus depuis cette interface.

Le lien « Mot de passe oublié » envoie une demande de réinitialisation par e-mail. Configurez les variables SMTP ci-dessus pour activer ce parcours ; aucun mot de passe ni jeton de réinitialisation n'est envoyé dans la réponse API ou conservé en clair en base.

Les clients connectés peuvent signaler une annonce depuis sa fiche. Les signalements sont vérifiés côté API et rejoignent la file de modération dans l'espace administrateur.

## Paiement de publication des annonces
Chaque annonce créée par un propriétaire reste en attente et nécessite un paiement de **1 000 FCFA (XOF)**. La publication est automatiquement activée uniquement après vérification côté serveur du statut payé auprès de l'API MTN MoMo ; un retour du navigateur ne suffit pas à valider le paiement.

L'accès client à la messagerie coûte **500 FCFA par annonce**, payé une seule fois par client. Après confirmation vérifiée par le serveur, le client conserve l'accès permanent à cette conversation. La lecture, l'envoi des messages et l'accès aux salles Socket.IO sont refusés tant que ce paiement n'est pas confirmé.

Les paiements sont demandés au numéro MTN Mobile Money indiqué par l'utilisateur. L'API conserve uniquement l'identifiant de transaction, le montant, la devise et le statut ; elle ne collecte ni ne stocke le code PIN Mobile Money. Le fournisseur confirme le résultat par une interrogation serveur-à-serveur de l'API Collection.

La messagerie prend en charge les messages en temps réel, l'indicateur de saisie et l'envoi d'images JPG, PNG ou WEBP (3 Mo maximum). Les images des conversations sont conservées dans `backend/private-uploads/`, hors du répertoire statique public, et servies uniquement aux participants autorisés. Sauvegardez ce répertoire avec PostgreSQL.

Les pages de résultat interrogent le statut MTN MoMo jusqu'à confirmation. Les identifiants MTN doivent être obtenus auprès de MTN et configurés uniquement dans les variables d'environnement sécurisées du serveur. Sans ces identifiants, les parcours de paiement répondent explicitement « indisponible » ; ne remplacez pas cette configuration par des clés fictives. Utilisez l'URL de base, l'environnement cible et les identifiants exacts fournis pour votre compte marchand et vérifiez la disponibilité de MoMo Collection au Bénin avant le lancement.

Avant le lancement, réalisez un parcours de test MTN avec un compte propriétaire et un compte client et vérifiez les confirmations côté serveur, puis effectuez un paiement réel contrôlé après l'activation du compte marchand. Ne placez jamais les clés MTN dans le frontend, le dépôt ou les journaux. Aucun paiement réel n'a été effectué pendant le développement.

## Lancer en développement
Ouvrez deux terminaux depuis la racine du projet :

```powershell
# Terminal 1 : API Express sur http://localhost:5000
npm run dev --prefix backend
```

```powershell
# Terminal 2 : application Vite sur http://localhost:5173
npm run dev
```

Le frontend utilise `VITE_API_URL` si elle est définie ; sinon il appelle `http://localhost:5000`. Les modifications de `VITE_API_URL` nécessitent un redémarrage du serveur Vite ou un nouveau build.

## Build et déploiement
Le frontend et l'API sont deux processus distincts : Express ne sert pas le dossier `dist/`. Construisez le frontend à la racine :

```powershell
npm run build
```

Publiez ensuite `dist/` sur un hébergement de fichiers statiques configuré pour renvoyer `index.html` sur les routes du frontend. Définissez `VITE_API_URL` à l'URL publique de l'API avant le build.

Sur l'hôte de l'API :

```bash
npm ci --prefix backend
npm --prefix backend start
```

Définissez les variables de production (notamment `NODE_ENV`, les accès PostgreSQL, `JWT_SECRET`, les identifiants MTN MoMo et les URL HTTPS) dans la configuration sécurisée de l'hébergeur. L'application doit pouvoir effectuer des connexions WebSocket Socket.IO à travers le reverse proxy ; configurez TLS, le transfert des en-têtes et l'upgrade WebSocket. Le serveur API expose son contrôle de santé à `GET /api/health`.

Le déploiement recommandé sur un VPS est Linux (Ubuntu/Debian), PostgreSQL local, PM2 pour l'API et Nginx pour le frontend ainsi que le proxy API/Socket.IO. Les fichiers correspondants sont fournis dans `ecosystem.config.cjs` et `deploy/`. Le script `deploy/deploy.sh` installe les dépendances, construit le frontend pour un déploiement sur le même domaine et recharge le backend sous PM2. Il ne crée pas le serveur, la base ou les certificats HTTPS : ces prérequis doivent être configurés une fois avant de l'exécuter.

### Déployer sur un VPS Ubuntu/Debian
1. Pointez le domaine vers le VPS, puis installez les dépendances système et Node 22 :

   ```bash
   sudo apt update
   sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx git curl
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install --global pm2
   ```

2. Clonez le projet dans `/var/www/immo229`. Créez un rôle et une base dédiés (`sudo -u postgres psql`, puis `CREATE ROLE immo229_user LOGIN;`, `\password immo229_user`, `CREATE DATABASE immo229 OWNER immo229_user;`). Importez ensuite le schéma avec `psql -h 127.0.0.1 -U immo229_user -d immo229 -f /var/www/immo229/backend/schema.sql`.
3. Copiez `deploy/backend.production.env.example` vers `backend/.env`, puis renseignez toutes les valeurs de production. `JWT_SECRET` doit être aléatoire et avoir au moins 32 caractères. Protégez le fichier avec `chmod 600 backend/.env` et ne copiez pas de secrets dans le dépôt.
4. Copiez `deploy/frontend.production.env.example` vers `.env.production`, remplacez `https://example.com` par le domaine public exact, et veillez à utiliser la même origine dans `backend/.env` pour `FRONTEND_URL` et `BACKEND_PUBLIC_URL`.
5. Copiez `deploy/nginx/immo229.conf` vers `/etc/nginx/sites-available/immo229`, remplacez `example.com` par votre domaine, activez le site (`sudo ln -s /etc/nginx/sites-available/immo229 /etc/nginx/sites-enabled/immo229`) puis vérifiez `sudo nginx -t`.
6. Obtenez le certificat HTTPS avec `sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com`.
7. Depuis `/var/www/immo229`, exécutez `bash deploy/deploy.sh`. Le script construit le frontend, démarre/recharge le backend sous PM2 puis vérifie son contrôle de santé. Le backend écoute uniquement sur `127.0.0.1:5000`.
8. Activez le redémarrage PM2 après un reboot : exécutez `pm2 startup`, puis la commande `sudo` affichée, et enfin `pm2 save`.
9. Configurez les variables MTN MoMo Collection fournies avec votre compte marchand dans l'environnement sécurisé du backend. Le paiement reste désactivé tant que cette configuration n'est pas complète.

Utilisez un compte PostgreSQL dédié, propriétaire de sa base, sans rôle superutilisateur. N'exposez pas le port PostgreSQL sur Internet. Ouvrez uniquement SSH, HTTP et HTTPS sur le pare-feu. Sauvegardez la base et le dossier `backend/uploads` séparément.

Ne lancez pas `server/src/index.js` : le point d'entrée de l'API Express est `backend/server.js`.

## Environnement local avec Docker
Pour tester localement PostgreSQL, le backend Express et le frontend statique, utilisez le fichier `docker-compose.yml` fourni. Cette configuration de démonstration n'est pas destinée à la production :

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env

docker compose up --build
```

Ensuite :
- Frontend : `http://localhost`
- Backend API : `http://localhost:5000`
- Base PostgreSQL : `localhost:5432`

Le frontend est construit avec `VITE_API_URL` et servi par Nginx, tandis que le backend démarre depuis `backend/Dockerfile`. Au premier démarrage, Docker initialise la base avec `backend/schema.sql`. Les volumes conservent PostgreSQL ainsi que les photos de profil et pièces jointes privées entre les redémarrages. Le port PostgreSQL est limité à la machine locale. Cette configuration de démonstration utilise des paramètres locaux et ne doit pas être exposée ni réutilisée en production ; suivez plutôt les étapes VPS ci-dessus.

## Tests de sécurité et de stabilisation (backend)
```powershell
# Terminal 1 : démarrer l'API
npm run dev --prefix backend
```

```powershell
# Terminal 2, à la racine du projet
npm run test:backend
```

Les tests appellent `http://localhost:5000` (ou `TEST_API_URL` si défini). Ils ne démarrent pas eux-mêmes le serveur.

Les scripts vérifient :
- En-têtes de sécurité et protection contre l'élévation de privilèges
- Contrôle des rôles, validation d'entrées et protections IDOR
- Réservations, annonces, favoris et administration
- Sécurité des uploads et associations de photos
- Messagerie en temps réel, validation et accès privé aux images jointes
- Requêtes SQL paramétrées

Quand PostgreSQL n'est pas joignable en environnement de développement, les appels peuvent être servis par le fallback `pg-mem` ; un succès dans ce cas ne remplace pas une validation avec PostgreSQL réel.

## Vérifications frontend
```bash
npm run test:frontend
```
Cette commande lint les pages concernées puis produit le build frontend. Aucun runner de tests unitaires React n'est configuré pour le moment.
