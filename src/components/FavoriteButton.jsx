import { useEffect, useState } from "react";
import { API_URL } from "../config/api";
import "./FavoriteButton.css";

function FavoriteButton({ propertyId, initialFavorite = false }) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    async function checkFavorite() {
      try {
        const response = await fetch(`${API_URL}/favorites`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const favorites = await response.json();

        setIsFavorite(
          favorites.some(
            (property) => String(property.id) === String(propertyId)
          )
        );
      } catch (error) {
        console.error("Erreur de chargement des favoris :", error);
      }
    }

    checkFavorite();
  }, [propertyId]);

  async function toggleFavorite(event) {
    event.preventDefault();
    event.stopPropagation();

    const token = localStorage.getItem("token");

    if (!token) {
      alert("Connecte-toi pour enregistrer tes favoris.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/favorites/${propertyId}`,
        {
          method: isFavorite ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de modifier le favori.");
      }

      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error(error);
      alert("Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`favorite-button ${isFavorite ? "active" : ""}`}
      onClick={toggleFavorite}
      disabled={loading}
      aria-label={
        isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
      }
      title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      {isFavorite ? "♥" : "♡"}
    </button>
  );
}

export default FavoriteButton;
