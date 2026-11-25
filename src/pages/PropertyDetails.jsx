import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./PropertyDetails.css";
import {
  AlertTriangle,
  ArrowRight,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import useSEO from "../utils/useSEO";
import { API_URL } from "../config/api";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const marker = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

function getStoredRole() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")?.role || null;
  } catch {
    return null;
  }
}

function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState({ text: "", type: "" });
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [contactingOwner, setContactingOwner] = useState(false);
  const [mtnPhoneNumber, setMtnPhoneNumber] = useState("");
  const [showContactPaymentModal, setShowContactPaymentModal] = useState(
    () => Boolean(location.state?.startContactPayment)
  );
  const [contactPaymentError, setContactPaymentError] = useState("");
  const currentRole = getStoredRole();
  const isPropertyAvailable = property?.status === "disponible";
  const propertyStatusLabel = property?.status === "loue"
    ? "Loué"
    : property?.status === "vendu"
      ? "Vendu"
      : property?.status === "disponible"
        ? "Disponible"
        : property?.status || "Statut inconnu";
  const unavailableMessage = property?.status === "loue"
    ? "Ce bien a déjà été loué. Les demandes de contact et de visite sont désactivées pour éviter toute confusion."
    : property?.status === "vendu"
      ? "Ce bien a déjà été vendu. Les demandes de contact et de visite sont désactivées."
      : "Cette annonce n'est actuellement pas disponible.";

  useEffect(() => {
    if (location.state?.startContactPayment && currentRole === "client") {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [currentRole, location.pathname, location.state, navigate]);

  function requestContact() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/connexion", {
        state: { from: location.pathname, startContactPayment: true },
      });
      return;
    }

    if (currentRole !== "client") {
      setContactPaymentError("La messagerie payante est réservée aux clients.");
      setShowContactPaymentModal(true);
      return;
    }

    setContactPaymentError("");
    setShowContactPaymentModal(true);
  }

  async function contactOwner() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/connexion", {
        state: { from: location.pathname, startContactPayment: true },
      });
      return;
    }

    if (currentRole !== "client") {
      setContactPaymentError("La messagerie payante est réservée aux clients.");
      return;
    }

    setContactingOwner(true);
    setContactPaymentError("");
    try {
      const paymentResponse = await fetch(
        `${API_URL}/property-payments/messaging/properties/${property.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phoneNumber: mtnPhoneNumber }),
        }
      );
      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok) {
        throw new Error(paymentData.message || "Impossible de préparer le paiement.");
      }

      if (!paymentData.paid) {
        navigate(`/messagerie/paiement?propertyId=${encodeURIComponent(property.id)}`);
        return;
      }

      const conversationResponse = await fetch(`${API_URL}/messages/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId: property.id }),
      });
      const conversationData = await conversationResponse.json();
      if (!conversationResponse.ok) {
        throw new Error(conversationData.message || "Impossible de démarrer la conversation.");
      }

      navigate(`/messages/${conversationData.id}`);
    } catch (contactError) {
      setContactPaymentError(contactError.message);
    } finally {
      setContactingOwner(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/connexion");
      return;
    }
    if (!reportReason || reportSubmitting) return;

    setReportSubmitting(true);
    setReportMessage({ text: "", type: "" });
    try {
      const response = await fetch(`${API_URL}/reports/properties/${property.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: reportReason,
          description: reportDescription,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Le signalement n'a pas pu être envoyé.");
      }
      setReportSubmitted(true);
      setReportMessage({ text: data.message, type: "success" });
    } catch (reportError) {
      setReportMessage({ text: reportError.message, type: "error" });
    } finally {
      setReportSubmitting(false);
    }
  }

  // Galerie multi-photos
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState("");

  const pageTitle = property ? `${property.title || property.titre || "Bien immobilier"} à ${property.city || property.ville || "Bénin"}` : "Détails du bien";
  const pageDescription = property?.description ? property.description.substring(0, 160) : "Découvrez cette annonce immobilière au Bénin sur IMOVA. Visite disponible en ligne.";
  const pageImage = selectedImage || property?.image || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80";

  const structuredData = property ? {
    "@context": "https://schema.org",
    "@type": property.type === "Maison" ? "SingleFamilyResidence" : property.type === "Appartement" ? "Apartment" : "Product",
    name: property.title || property.titre,
    description: property.description,
    image: pageImage,
    offers: {
      "@type": "Offer",
      price: property.price || property.prix,
      priceCurrency: "XOF",
      availability: "https://schema.org/InStock",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: property.city || property.ville || "Cotonou",
      addressCountry: "BJ",
    },
  } : null;

  useSEO({
    title: pageTitle,
    description: pageDescription,
    image: pageImage,
    structuredData,
  });

  const [isFavorite, setIsFavorite] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const checkFavorite = async () => {
      try {
        const response = await fetch(
          `${API_URL}/favorites/check/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        const data = await response.json();
        setIsFavorite(data.favorite);
      } catch (error) {
        console.error(error);
      }
    };
    checkFavorite();
  }, [id]);

  // Étape 46 : Enregistrer la consultation de l'annonce
  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem("token");
    fetch(`${API_URL}/properties/${id}/view`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch((error) => {
      console.error("Erreur de comptage des vues :", error);
    });
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/properties/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Bien immobilier introuvable.");
        }
        return res.json();
      })
      .then((data) => {
        setProperty(data);

        // Charger les images depuis la réponse API
        if (data.images && data.images.length > 0) {
          setImages(data.images);
          setSelectedImage(data.images[0].image_url);
        } else if (data.image) {
          setSelectedImage(data.image);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const toggleFavorite = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Connectez-vous pour ajouter des favoris.");
      // We don't have navigate available, let's use window.location or add navigate
      window.location.href = "/connexion";
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/favorites/${id}`,
        {
          method: isFavorite ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      setIsFavorite(data.favorite);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2>Chargement des détails du bien...</h2>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px" }}>
        <h1>Bien immobilier introuvable</h1>
        <p style={{ marginTop: "20px" }}>
          <Link to="/biens" className="back-link">← Retour aux biens</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="details-page">

        {/* ══════ GALERIE MULTI-PHOTOS ══════ */}
        <div className="gallery">

          <div className="main-image">
            <img
              src={selectedImage || property.image}
              alt={property.title}
            />
          </div>

          {images.length > 1 && (
            <div className="gallery-thumbnails">
              {images.map((image) => (
                <button
                  key={image.id}
                  onClick={() =>
                    setSelectedImage(image.image_url)
                  }
                  className={
                    selectedImage === image.image_url
                      ? "thumbnail active"
                      : "thumbnail"
                  }
                >
                  <img
                    src={image.image_url}
                    alt="Photo du bien"
                  />
                </button>
              ))}
            </div>
          )}

        </div>

        <div className="details-content">

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
            <div>
              <h1>{property.title}</h1>
              <span className={`property-status status-${property.status || "disponible"}`}>
                {propertyStatusLabel}
              </span>
              {(property.is_verified || property.owner_is_verified) && (
                <div className="verification-badges" aria-label="Badges de vérification IMOVA">
                  {property.is_verified && <span>✓ Annonce vérifiée par IMOVA</span>}
                  {property.owner_is_verified && <span>✓ Propriétaire vérifié par IMOVA</span>}
                </div>
              )}
            </div>
            <button
              className={isFavorite ? "favorite-btn active" : "favorite-btn"}
              onClick={toggleFavorite}
            >
              {isFavorite ? "❤️" : "♡"}
              <span>
                {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              </span>
            </button>
          </div>

          <p className="location">
            📍 {property.location}
          </p>

          <h2>{property.priceFormatted || `${Number(property.price).toLocaleString("fr-FR")} FCFA`}</h2>

          <div className="details-box">

            <span>🛏️ {property.rooms}</span>

            <span>🚿 {property.bathrooms}</span>

          </div>

          <h3>Description</h3>

          <p className="description-text">
            {property.description}
          </p>

          {property.latitude && property.longitude && (
            <section className="property-map">
              <h2>📍 Localisation du bien</h2>
              <MapContainer
                center={[Number(property.latitude), Number(property.longitude)]}
                zoom={15}
                scrollWheelZoom={false}
                style={{ height: "400px", width: "100%", borderRadius: "10px", zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[Number(property.latitude), Number(property.longitude)]} icon={marker}>
                  <Popup>
                    <strong>{property.titre || property.title}</strong><br />
                    {property.ville}
                    {property.quartier && ` - ${property.quartier}`}
                  </Popup>
                </Marker>
              </MapContainer>
            </section>
          )}

          {/* Propriétaire info */}
          {property.owner && (
            <div style={{ marginBottom: "25px", padding: "15px", background: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
              <p style={{ margin: 0, fontWeight: "bold", color: "#166534" }}>
                👤 Annonce publiée par : {property.owner.nom}
              </p>
              {property.owner_is_verified && (
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#276347", fontWeight: 700 }}>
                  ✓ Propriétaire vérifié par IMOVA
                </p>
              )}
              {isPropertyAvailable && property.owner.telephone && (
                <p style={{ margin: "5px 0 0", fontSize: "14px", color: "#15803d" }}>
                  📞 {property.owner.telephone}
                </p>
              )}
            </div>
          )}

          {isPropertyAvailable ? (
            <>
              {property.owner?.telephone && (
                <a
                  href={`tel:${property.owner.telephone}`}
                  className="contact-btn"
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  📞 Appeler {property.owner?.nom ? `(${property.owner.nom})` : ""}
                </a>
              )}

              <button
                type="button"
                className="contact-owner-btn"
                onClick={requestContact}
                disabled={contactingOwner}
              >
                <MessageCircle size={20} aria-hidden="true" />
                <span>{contactingOwner ? "Préparation..." : "Envoyer un message au propriétaire"}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <div className="contact-owner-details">
                <ShieldCheck size={17} aria-hidden="true" />
                <p>
                  Messagerie client activée après confirmation d’un paiement unique de{" "}
                  <strong>500 FCFA</strong>.
                </p>
              </div>
            </>
          ) : (
            <div className={`property-unavailable-notice status-${property?.status || "unknown"}`} role="status">
              <strong>{propertyStatusLabel}</strong>
              <p>{unavailableMessage}</p>
            </div>
          )}

          {currentRole !== "proprietaire" && currentRole !== "admin" && (
            <button
              type="button"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
              onClick={() => {
                if (!localStorage.getItem("token")) {
                  navigate("/connexion");
                  return;
                }
                setShowReportModal(true);
              }}
              disabled={reportSubmitted}
            >
              <AlertTriangle size={16} />
              {reportSubmitted ? "Annonce signalée" : "Signaler cette annonce"}
            </button>
          )}

        </div>

        {showContactPaymentModal && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !contactingOwner) {
                setShowContactPaymentModal(false);
                setContactPaymentError("");
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-payment-title"
              className="contact-payment-dialog w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <span className="contact-payment-icon">
                    <MessageCircle size={21} aria-hidden="true" />
                  </span>
                  <h2 id="contact-payment-title" className="text-xl font-bold text-slate-900">
                    Contacter le propriétaire
                  </h2>
                  <p className="contact-payment-description">
                    Activez la messagerie client avec un paiement unique de <strong>500 FCFA</strong>.
                    Validez la demande MTN MoMo envoyée sur votre téléphone. Vous pourrez écrire au
                    propriétaire dès confirmation du paiement.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => {
                    setShowContactPaymentModal(false);
                    setContactPaymentError("");
                  }}
                  disabled={contactingOwner}
                  aria-label="Fermer"
                >
                  <X size={19} />
                </button>
              </div>

              {contactPaymentError && (
                <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {contactPaymentError}
                </p>
              )}

              {currentRole === "client" && (
                <div className="mb-5">
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="contact-mtn-phone">
                    Numéro MTN Mobile Money
                  </label>
                  <input
                    id="contact-mtn-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+229 XX XX XX XX"
                    value={mtnPhoneNumber}
                    onChange={(event) => setMtnPhoneNumber(event.target.value)}
                    disabled={contactingOwner}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Ne communiquez jamais votre code PIN à qui que ce soit.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="contact-payment-cancel"
                  onClick={() => {
                    setShowContactPaymentModal(false);
                    setContactPaymentError("");
                  }}
                  disabled={contactingOwner}
                >
                  Fermer
                </button>
                {currentRole === "client" ? (
                  <button
                    type="button"
                    className="contact-payment-confirm"
                    onClick={contactOwner}
                    disabled={contactingOwner}
                  >
                    {contactingOwner ? (
                      <>
                        <LoaderCircle size={18} className="contact-payment-spinner" />
                        Préparation du paiement...
                      </>
                    ) : (
                      <>
                        Payer 500 FCFA
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                ) : (
                  <p className="contact-payment-role-note">
                    {currentRole
                      ? "La messagerie payante est réservée aux comptes clients."
                      : "Connectez-vous avec un compte client pour activer la messagerie."}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {showReportModal && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !reportSubmitting) {
                setShowReportModal(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="property-report-title"
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <AlertTriangle size={20} />
                  </span>
                  <h2 id="property-report-title" className="text-xl font-bold text-slate-900">
                    Signaler cette annonce
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Votre signalement sera examiné par notre équipe de modération.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setShowReportModal(false)}
                  disabled={reportSubmitting}
                  aria-label="Fermer"
                >
                  <X size={19} />
                </button>
              </div>

              <form onSubmit={submitReport} className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Motif du signalement <span className="text-red-500">*</span>
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    required
                    disabled={reportSubmitted}
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 font-normal text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                  >
                    <option value="">Sélectionnez un motif</option>
                    <option>Informations trompeuses</option>
                    <option>Prix incorrect</option>
                    <option>Annonce déjà louée ou vendue</option>
                    <option>Contenu suspect ou frauduleux</option>
                    <option>Photos inappropriées</option>
                    <option>Autre</option>
                  </select>
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Détails complémentaires <span className="font-normal text-slate-400">(facultatif)</span>
                  <textarea
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Expliquez brièvement ce qui vous semble problématique..."
                    disabled={reportSubmitted}
                    className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3.5 py-3 font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                  />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-400">
                    {reportDescription.length}/1 000
                  </span>
                </label>

                {reportMessage.text && (
                  <p
                    role={reportMessage.type === "error" ? "alert" : "status"}
                    className={`rounded-lg px-3.5 py-3 text-sm ${
                      reportMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {reportMessage.text}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {reportSubmitted ? "Fermer" : "Annuler"}
                  </button>
                  {!reportSubmitted && (
                    <button
                      type="submit"
                      disabled={reportSubmitting || !reportReason}
                      className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reportSubmitting ? "Envoi en cours..." : "Envoyer le signalement"}
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}

export default PropertyDetails;
