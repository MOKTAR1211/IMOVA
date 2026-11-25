#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [[ ! -f backend/.env ]]; then
  echo "Configuration manquante : créez backend/.env depuis deploy/backend.production.env.example." >&2
  exit 1
fi

for key in SMTP_HOST SMTP_USER SMTP_PASSWORD SMTP_FROM; do
  if ! grep -Eq "^${key}=.+$" backend/.env; then
    echo "Configuration SMTP manquante : renseignez ${key} dans backend/.env avant le déploiement." >&2
    exit 1
  fi
done

if [[ ! -f .env.production ]] || ! grep -Eq '^VITE_API_URL=https://[^[:space:]]+[[:space:]]*$' .env.production; then
  echo "Configuration frontend manquante : définissez VITE_API_URL=https://votre-domaine dans .env.production." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 est requis. Installez-le avec : sudo npm install --global pm2" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl est requis pour vérifier le démarrage de l'API." >&2
  exit 1
fi

npm ci
npm ci --prefix backend
npm run build
pm2 startOrReload ecosystem.config.cjs --env production --update-env
pm2 save

for attempt in {1..20}; do
  if curl --silent --show-error --fail http://127.0.0.1:5000/api/health >/dev/null; then
    echo "Déploiement terminé : l'API répond sur http://127.0.0.1:5000/api/health"
    exit 0
  fi
  sleep 2
done

pm2 logs immo229-backend --lines 50 --nostream
echo "Le backend n'a pas répondu au contrôle de santé après 40 secondes." >&2
exit 1
