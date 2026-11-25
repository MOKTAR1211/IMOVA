import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../config/api";
import "./VisitBookingModal.css";

const DEFAULT_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

export default function VisitBookingModal({ property, isOpen, onClose, onSuccess }) {
  if (!isOpen || !property) return null;

  // Date par défaut : demain
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split("T")[0];

  const todayStr = new Date().toISOString().split("T")[0];

  const [visitDate, setVisitDate] = useState(defaultDateStr);
  const [visitTime, setVisitTime] = useState("");
  const [message, setMessage] = useState("");
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", type: "" });
  const [isSuccess, setIsSuccess] = useState(false);

  // Charger les créneaux déjà réservés pour ce bien à la date choisie
  useEffect(() => {
    if (!property?.id || !visitDate) return;

    async function fetchBookedSlots() {
      setLoadingSlots(true);
      try {
        const res = await fetch(
          `${API_URL}/visits/property/${property.id}/booked-slots?date=${visitDate}`
        );
        if (res.ok) {
          const data = await res.json();
          // Liste des heures réservées
          const bookedTimes = data.map((b) => b.visit_time);
          setBookedSlots(bookedTimes);

          // Si l'heure courante sélectionnée est maintenant réservée, la désélectionner
          if (bookedTimes.includes(visitTime)) {
            setVisitTime("");
          }
        }
      } catch (err) {
        console.error("Erreur créneaux :", err);
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchBookedSlots();
  }, [property?.id, visitDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    if (!token) {
      setFeedback({
        text: "Veuillez vous connecter pour réserver une visite.",
        type: "error",
      });
      return;
    }

    if (!visitDate) {
      setFeedback({ text: "Veuillez sélectionner une date.", type: "error" });
      return;
    }

    if (!visitTime) {
      setFeedback({ text: "Veuillez choisir un créneau horaire.", type: "error" });
      return;
    }

    setSubmitting(true);
    setFeedback({ text: "", type: "" });

    try {
      const response = await fetch(`${API_URL}/visits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          property_id: property.id,
          visit_date: visitDate,
          visit_time: visitTime,
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFeedback({
          text: data.message || "Impossible de réserver ce créneau.",
          type: "error",
        });
        setSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setFeedback({
        text: data.message || "Visite programmée avec succès !",
        type: "success",
      });

      if (onSuccess) {
        onSuccess(data.visit);
      }
    } catch (err) {
      console.error(err);
      setFeedback({
        text: "Erreur de connexion au serveur. Réessayez.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="visit-modal-backdrop" onClick={onClose}>
      <div
        className="visit-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="visit-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="visit-modal-header">
          <h2>📅 Réserver une visite</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
            Choisissez le jour et l'heure qui vous conviennent pour visiter ce bien.
          </p>

          <div className="visit-property-summary">
            <img
              src={
                property.image ||
                property.image_url ||
                "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=300&q=80"
              }
              alt={property.title || property.titre}
              className="visit-property-thumb"
            />
            <div className="visit-property-info">
              <h4>{property.title || property.titre}</h4>
              <p>📍 {property.location || property.ville}</p>
            </div>
          </div>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <span style={{ fontSize: "48px" }}>🎉</span>
            <h3 style={{ color: "#0d8b68", margin: "10px 0 6px 0" }}>
              Demande envoyée avec succès !
            </h3>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: "1.5" }}>
              Le propriétaire a été notifié de votre demande pour le{" "}
              <strong>{visitDate}</strong> à <strong>{visitTime}</strong>. Vous
              pouvez suivre le statut de votre réservation à tout moment.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px" }}>
              <Link
                to="/mes-visites"
                className="visit-submit-btn"
                style={{ textDecoration: "none", display: "inline-block" }}
              >
                Voir mes visites 📅
              </Link>
              <button
                type="button"
                className="visit-cancel-btn"
                onClick={onClose}
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Champ Date */}
            <div className="visit-form-group">
              <label htmlFor="visit-date-input">Sélectionnez la date :</label>
              <input
                id="visit-date-input"
                type="date"
                min={todayStr}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
              />
            </div>

            {/* Créneaux Horaires */}
            <div className="visit-form-group" style={{ marginTop: "10px" }}>
              <label>
                Choisissez une heure disponible{" "}
                {loadingSlots && <small>(actualisation...)</small>} :
              </label>

              <div className="visit-slots-grid">
                {DEFAULT_SLOTS.map((slot) => {
                  const isBooked = bookedSlots.includes(slot);
                  const isSelected = visitTime === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isBooked}
                      className={`visit-slot-btn ${isSelected ? "selected" : ""}`}
                      onClick={() => setVisitTime(slot)}
                      title={isBooked ? "Créneau déjà réservé" : `Choisir ${slot}`}
                    >
                      {slot} {isBooked ? "✕" : ""}
                    </button>
                  );
                })}
              </div>

              <div className="visit-slot-legend">
                <div className="legend-item">
                  <span className="legend-dot available"></span>
                  <span>Disponible</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot booked"></span>
                  <span>Déjà réservé</span>
                </div>
              </div>
            </div>

            {/* Note / Message optionnel */}
            <div className="visit-form-group" style={{ marginTop: "10px" }}>
              <label htmlFor="visit-notes">
                Message pour le propriétaire (optionnel) :
              </label>
              <textarea
                id="visit-notes"
                rows="3"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex : Je serai accompagné de mon conjoint, merci de prévoir 20 minutes..."
                maxLength="500"
              />
            </div>

            {feedback.text && (
              <div className={`visit-feedback-alert ${feedback.type}`}>
                {feedback.type === "error" ? "⚠️ " : "✓ "}
                {feedback.text}
              </div>
            )}

            <div className="visit-modal-actions">
              <button
                type="button"
                className="visit-cancel-btn"
                onClick={onClose}
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="visit-submit-btn"
                disabled={submitting || !visitTime}
              >
                {submitting ? "Envoi en cours..." : "Confirmer la réservation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
