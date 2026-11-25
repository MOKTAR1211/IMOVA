import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../config/api";
import "./MyProperties.css";

function MyProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [payingPropertyId, setPayingPropertyId] = useState(null);
  const [mtnPhoneNumber, setMtnPhoneNumber] = useState("");

  async function loadProperties() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Connecte-toi pour gérer tes annonces.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/properties/mine`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible de charger les annonces.");
      }

      setProperties(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  async function deleteProperty(id) {
    const confirmed = window.confirm(
      "Veux-tu vraiment supprimer cette annonce ? Cette action est définitive."
    );

    if (!confirmed) return;

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/properties/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "La suppression a échoué.");
      }

      setProperties((current) =>
        current.filter((property) => String(property.id) !== String(id))
      );
    } catch (err) {
      alert(err.message);
    }
  }

  async function updatePropertyStatus(id, status) {
    try {
      const response = await fetch(
        `${API_URL}/properties/${id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Échec de la mise à jour.");
      }
      await loadProperties();
    } catch (error) {
      alert(error.message);
    }
  }

  async function startPublicationPayment(id) {
    setPaymentError("");
    setPayingPropertyId(id);

    try {
      const response = await fetch(`${API_URL}/property-payments/properties/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ phoneNumber: mtnPhoneNumber }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible de préparer le paiement.");
      }

      if (data.paid) {
        await loadProperties();
        return;
      }

      window.location.assign(`/publication/paiement?propertyId=${encodeURIComponent(id)}`);
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPayingPropertyId(null);
    }
  }

  if (loading) {
    return <p className="my-properties-message">Chargement des annonces...</p>;
  }

  if (error) {
    return (
      <div className="my-properties-message">
        <p>{error}</p>
        <button onClick={loadProperties}>Réessayer</button>
      </div>
    );
  }

  return (
    <main className="my-properties-page">
      <header className="my-properties-header">
        <div>
          <p className="my-properties-eyebrow">ESPACE PROPRIÉTAIRE</p>
          <h1>Mes annonces</h1>
          <p>Gère tes annonces et termine leur paiement pour les publier.</p>
        </div>

        <Link className="my-properties-add" to="/add-property">
          + Publier un bien
        </Link>
      </header>

      {properties.length === 0 ? (
        <section className="my-properties-empty">
          <h2>Tu n'as pas encore publié d'annonce.</h2>
          <p>Publie ton premier bien pour le présenter aux visiteurs.</p>
          <Link className="my-properties-add" to="/add-property">
            Créer une annonce
          </Link>
        </section>
      ) : (
        <section className="my-properties-list">
          {paymentError && <p role="alert" className="my-properties-message">{paymentError}</p>}
          {properties.map((property) => (
            <article className="my-property-card" key={property.id}>
              {property.image_url ? (
                <img
                  src={property.image_url}
                  alt={property.title || property.titre || "Bien immobilier"}
                />
              ) : (
                <div className="my-property-no-image">Pas de photo</div>
              )}

              <div className="my-property-info">
                <h2>{property.title || property.titre}</h2>
                <p>{property.city || property.ville || property.location || "Bénin"}</p>
                <strong>
                  {property.price != null || property.prix != null
                    ? `${Number(property.price ?? property.prix).toLocaleString("fr-FR")} FCFA`
                    : "Prix non renseigné"}
                </strong>

                <div className="my-property-actions">
                  {property.publication_payment_status === "pending" ? (
                    <>
                      <span role="status">Paiement de 1 000 FCFA requis</span>
                      <label className="sr-only" htmlFor={`mtn-phone-${property.id}`}>
                        Numéro MTN Mobile Money
                      </label>
                      <input
                        id={`mtn-phone-${property.id}`}
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="+229 XX XX XX XX"
                        value={mtnPhoneNumber}
                        onChange={(event) => setMtnPhoneNumber(event.target.value)}
                      />
                      <button
                        type="button"
                        disabled={payingPropertyId === property.id || !mtnPhoneNumber.trim()}
                        onClick={() => startPublicationPayment(property.id)}
                      >
                        {payingPropertyId === property.id ? "Préparation..." : "Payer et publier"}
                      </button>
                    </>
                  ) : (
                    <select
                      className="my-property-status-select"
                      value={property.status || "disponible"}
                      onChange={(e) =>
                        updatePropertyStatus(property.id, e.target.value)
                      }
                    >
                      <option value="disponible">Disponible</option>
                      <option value="loue">Loué</option>
                      <option value="vendu">Vendu</option>
                    </select>
                  )}

                  <Link to={`/properties/${property.id}`}>
                    Voir
                  </Link>

                  <Link to={`/edit-property/${property.id}`}>
                    Modifier
                  </Link>

                  <button
                    type="button"
                    className="my-property-delete"
                    onClick={() => deleteProperty(property.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default MyProperties;
