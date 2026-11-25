import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FavoriteButton from "../components/FavoriteButton";
import { API_URL } from "../config/api";
import "./Favorites.css";

function Favorites() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadFavorites() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Connecte-toi pour consulter tes favoris.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/favorites`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Impossible de charger les favoris.");
      }

      const data = await response.json();
      setProperties(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFavorites();
  }, []);

  if (loading) {
    return <p className="favorites-message">Chargement des favoris...</p>;
  }

  if (error) {
    return (
      <div className="favorites-message">
        <p>{error}</p>
        <button onClick={loadFavorites}>Réessayer</button>
      </div>
    );
  }

  return (
    <div>
      <nav className="navbar">
        <Link to="/" className="logo">
          Immo<span>229</span>
        </Link>
        <div className="nav-links">
          <Link to="/">Accueil</Link>
          <Link to="/biens">Biens</Link>
          <Link to="/favoris">❤️ Favoris</Link>
          <Link to="/notifications">🔔 Notifications</Link>
          <Link to="/messages">💬 Messages</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <main className="favorites-page">
        <header className="favorites-header">
          <div>
            <p className="favorites-eyebrow">MON ESPACE IMOVA</p>
            <h1>Mes favoris ♥</h1>
            <p>Retrouve facilement les biens qui t'intéressent.</p>
          </div>

          <span className="favorites-count">
            {properties.length} bien(s)
          </span>
        </header>

        {properties.length === 0 ? (
          <section className="favorites-empty">
            <div className="empty-heart">♡</div>
            <h2>Aucun favori pour le moment</h2>
            <p>
              Explore les annonces et ajoute les biens que tu souhaites
              garder sous la main.
            </p>
            <Link to="/biens" className="favorites-explore">
              Explorer les annonces
            </Link>
          </section>
        ) : (
          <section className="favorites-grid">
            {properties.map((property) => (
              <article className="favorite-card" key={property.id}>
                <div className="favorite-card-top">
                  <span className="favorite-tag">Enregistré</span>
                  <FavoriteButton propertyId={property.id} />
                </div>

                {(property.image_url || property.image) && (
                  <img
                    className="favorite-image"
                    src={property.image_url || property.image}
                    alt={property.title || property.titre || "Bien immobilier"}
                  />
                )}

                <div className="favorite-card-content">
                  <h2>{property.title || property.titre || "Bien immobilier"}</h2>

                  <p className="favorite-location">
                    <span aria-hidden="true">📍</span>{" "}
                    {property.city || property.ville || property.location || "Bénin"}
                    {property.quartier && `, ${property.quartier}`}
                  </p>

                  <p className="favorite-price">
                    {(property.price != null || property.prix != null)
                      ? `${Number(property.price ?? property.prix).toLocaleString("fr-FR")} FCFA`
                      : "Prix non renseigné"}
                  </p>

                  <Link
                    to={`/bien/${property.id}`}
                    className="favorite-details"
                  >
                    Voir les détails →
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default Favorites;
