/**
 * Configuration centralisée de l'API pour IMOVA.
 * En développement : utilise http://localhost:5000 (ou la valeur de VITE_API_URL).
 * En production : utilise l'URL publique de l'API définie par VITE_API_URL,
 * ou le même domaine que le frontend si aucune URL n'est configurée.
 */

const rawApiUrl = import.meta.env.VITE_API_URL
  ?? (import.meta.env.PROD ? window.location.origin : "http://localhost:5000");

// Nettoyage de l'URL pour supprimer un slash final accidentel
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

// URL de base préfixée pour les routes de l'API REST
export const API_URL = `${API_BASE_URL}/api`;

export default API_BASE_URL;
