import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { calculateDistance } from "../utils/distance";
import "./NearbyProperties.css";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function NearbyProperties() {
  const [properties, setProperties] = useState([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function searchNearby(lat, lng) {
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const response = await fetch(`${API_URL}/api/properties`);

      if (!response.ok) {
        throw new Error("Impossible de charger les annonces.");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Le format des annonces est invalide.");
      }

      const results = data
        .filter((property) => {
          const propertyLat = Number(property.latitude);
          const propertyLng = Number(property.longitude);

          return (
            property.latitude != null &&
            property.longitude != null &&
            Number.isFinite(propertyLat) &&
            Number.isFinite(propertyLng) &&
            propertyLat >= -90 &&
            propertyLat <= 90 &&
            propertyLng >= -180 &&
            propertyLng <= 180
          );
        })
        .map((property) => ({
          ...property,
          distance: calculateDistance(
            Number(lat),
            Number(lng),
            Number(property.latitude),
            Number(property.longitude)
          ),
        }))
        .filter((property) => property.distance <= Number(radius))
        .sort((a, b) => a.distance - b.distance);

      setProperties(results);
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur ce navigateur.");
      return;
    }

    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setLatitude(String(lat));
        setLongitude(String(lng));
        searchNearby(lat, lng);
      },
      () => {
        setError(
          "Position inaccessible. Autorise la localisation ou saisis les coordonnées."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    const lat = Number(latitude);
    const lng = Number(longitude);
    const distance = Number(radius);

    if (
      latitude.trim() === "" ||
      longitude.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setError("Saisis une latitude et une longitude valides.");
      return;
    }

    if (!Number.isFinite(distance) || distance <= 0) {
      setError("Choisis un rayon valide.");
      return;
    }

    searchNearby(lat, lng);
  }

  return (
    <main className="nearby-page">
      <h1>Biens immobiliers à proximité</h1>
      <p>Recherche les annonces autour d’un emplacement.</p>

      <button type="button" className="nearby-locate-btn" onClick={useMyLocation}>
        📍 Utiliser ma position actuelle
      </button>

      <form onSubmit={handleSubmit} className="nearby-form">
        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="Ex. 6.448"
            required
          />
        </label>

        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="Ex. 2.355"
            required
          />
        </label>

        <label>
          Rayon de recherche
          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          >
            <option value="2">2 km</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="20">20 km</option>
            <option value="50">50 km</option>
          </select>
        </label>

        <button type="submit" className="nearby-search-btn" disabled={loading}>
          {loading ? "Recherche..." : "Rechercher"}
        </button>
      </form>

      {error && <p className="nearby-error" role="alert">{error}</p>}

      {loading && <p>Chargement des annonces...</p>}

      {!loading && searched && !error && (
        <h2>{properties.length} bien(s) trouvé(s)</h2>
      )}

      <section className="nearby-results">
        {properties.map((property) => (
          <article className="nearby-card" key={property.id}>
            {(property.image_url || property.image) && (
              <img
                src={property.image_url || property.image}
                alt={property.title || property.titre}
              />
            )}

            <div>
              <h3>{property.title || property.titre}</h3>
              <p>{property.city || property.ville}</p>
              <p>
                <strong>
                  {Number(property.price || property.prix).toLocaleString("fr-FR")} FCFA
                </strong>
              </p>
              <p className="nearby-distance">
                À {property.distance.toFixed(2)} km de la position choisie
              </p>

              <Link to={`/properties/${property.id}`} className="nearby-link">
                Voir le bien
              </Link>
            </div>
          </article>
        ))}
      </section>

      {!loading && searched && !error && properties.length === 0 && (
        <p className="nearby-empty">Aucun bien géolocalisé trouvé dans ce rayon.</p>
      )}
    </main>
  );
}
