import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../config/api";
import "./MyVisits.css";

const STATUS_LABELS = {
  en_attente: { label: "⏳ En attente", class: "en_attente" },
  pending: { label: "⏳ En attente", class: "en_attente" },
  confirmee: { label: "✅ Confirmée", class: "confirmee" },
  acceptee: { label: "✅ Confirmée", class: "confirmee" },
  accepted: { label: "✅ Confirmée", class: "confirmee" },
  terminee: { label: "🏁 Terminée", class: "terminee" },
  annulee: { label: "❌ Annulée", class: "annulee" },
  cancelled: { label: "❌ Annulée", class: "annulee" },
  rejected: { label: "❌ Refusée", class: "annulee" },
};

export default function MyVisits() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTab, setCurrentTab] = useState("all");
  const [actionLoading, setActionLoading] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");

  const fetchVisits = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/visits/my-visits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setVisits(data);
      } else {
        setError(data.message || "Erreur lors du chargement des visites.");
      }
    } catch (err) {
      console.error(err);
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  const handleUpdateStatus = async (visitId, newStatus) => {
    if (newStatus === "annulee") {
      const confirmCancel = window.confirm(
        "Êtes-vous sûr de vouloir annuler cette réservation ?"
      );
      if (!confirmCancel) return;
    }

    setActionLoading(visitId);
    try {
      const response = await fetch(
        `${API_URL}/visits/${visitId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Mettre à jour l'état local
        setVisits((prev) =>
          prev.map((v) =>
            v.id === visitId ? { ...v, status: newStatus } : v
          )
        );
      } else {
        alert(data.message || "Impossible de modifier la réservation.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion.");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrage selon l'onglet sélectionné
  const filteredVisits = visits.filter((v) => {
    if (currentTab === "all") return true;
    if (currentTab === "en_attente")
      return v.status === "en_attente" || v.status === "pending";
    if (currentTab === "confirmee")
      return (
        v.status === "confirmee" ||
        v.status === "acceptee" ||
        v.status === "accepted"
      );
    if (currentTab === "terminee") return v.status === "terminee";
    if (currentTab === "annulee")
      return (
        v.status === "annulee" ||
        v.status === "cancelled" ||
        v.status === "rejected"
      );
    return true;
  });

  if (!token) {
    return (
      <div className="my-visits-container">
        <div className="empty-visits">
          <span>🔒</span>
          <h3>Connexion requise</h3>
          <p>Connectez-vous pour consulter et gérer vos réservations de visite.</p>
          <Link to="/connexion" className="visit-submit-btn" style={{ textDecoration: "none" }}>
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="my-visits-container">
      <div className="my-visits-header">
        <div>
          <h1>📅 Réservations & Visites</h1>
          <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "14px" }}>
            Consultez et gérez vos rendez-vous de visite immobilière.
          </p>
        </div>

        <Link
          to="/biens"
          className="visit-submit-btn"
          style={{ textDecoration: "none", fontSize: "13px" }}
        >
          🔍 Trouver d'autres biens
        </Link>
      </div>

      {/* Onglets de filtrage */}
      <div className="visits-tabs">
        <button
          className={`visits-tab-btn ${currentTab === "all" ? "active" : ""}`}
          onClick={() => setCurrentTab("all")}
        >
          Toutes ({visits.length})
        </button>
        <button
          className={`visits-tab-btn ${
            currentTab === "en_attente" ? "active" : ""
          }`}
          onClick={() => setCurrentTab("en_attente")}
        >
          ⏳ En attente (
          {
            visits.filter(
              (v) => v.status === "en_attente" || v.status === "pending"
            ).length
          }
          )
        </button>
        <button
          className={`visits-tab-btn ${
            currentTab === "confirmee" ? "active" : ""
          }`}
          onClick={() => setCurrentTab("confirmee")}
        >
          ✅ Confirmées (
          {
            visits.filter(
              (v) =>
                v.status === "confirmee" ||
                v.status === "acceptee" ||
                v.status === "accepted"
            ).length
          }
          )
        </button>
        <button
          className={`visits-tab-btn ${
            currentTab === "terminee" ? "active" : ""
          }`}
          onClick={() => setCurrentTab("terminee")}
        >
          🏁 Terminées ({visits.filter((v) => v.status === "terminee").length})
        </button>
        <button
          className={`visits-tab-btn ${
            currentTab === "annulee" ? "active" : ""
          }`}
          onClick={() => setCurrentTab("annulee")}
        >
          ❌ Annulées (
          {
            visits.filter(
              (v) =>
                v.status === "annulee" ||
                v.status === "cancelled" ||
                v.status === "rejected"
            ).length
          }
          )
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Chargement de vos visites...</p>
        </div>
      ) : error ? (
        <div className="visit-feedback-alert error">{error}</div>
      ) : filteredVisits.length === 0 ? (
        <div className="empty-visits">
          <span>📅</span>
          <h3>Aucune réservation trouvée</h3>
          <p>
            {currentTab === "all"
              ? "Vous n'avez pas encore de visite programmée."
              : "Aucune visite ne correspond à ce filtre."}
          </p>
          <Link
            to="/biens"
            className="visit-submit-btn"
            style={{ textDecoration: "none" }}
          >
            Explorer le catalogue
          </Link>
        </div>
      ) : (
        <div className="visits-list">
          {filteredVisits.map((visit) => {
            const isOwner = currentUser.id === visit.owner_id;
            const isClient = currentUser.id === visit.user_id;
            const statusConfig = STATUS_LABELS[visit.status] || {
              label: visit.status,
              class: "en_attente",
            };
            const isPending =
              visit.status === "en_attente" || visit.status === "pending";
            const isConfirmed =
              visit.status === "confirmee" ||
              visit.status === "acceptee" ||
              visit.status === "accepted";
            const isCancelled =
              visit.status === "annulee" ||
              visit.status === "cancelled" ||
              visit.status === "rejected";
            const isCompleted = visit.status === "terminee";

            return (
              <div className="visit-card-advanced" key={visit.id}>
                <img
                  src={
                    visit.image_url ||
                    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=400&q=80"
                  }
                  alt={visit.property_title}
                  className="visit-card-thumb"
                />

                <div className="visit-card-body">
                  <div>
                    <div className="visit-card-top">
                      <div>
                        <h3>{visit.property_title}</h3>
                        <p className="visit-card-location">
                          📍 {visit.city} {visit.district ? `— ${visit.district}` : ""}
                        </p>
                      </div>

                      <span
                        className={`visit-status-badge ${statusConfig.class}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="visit-schedule-details">
                      <span>
                        📅 Date : <strong>{visit.visit_date}</strong>
                      </span>
                      <span>
                        ⏰ Heure : <strong>{visit.visit_time}</strong>
                      </span>
                      {visit.property_price && (
                        <span>
                          💰 Prix :{" "}
                          <strong>
                            {Number(visit.property_price).toLocaleString("fr-FR")} FCFA
                          </strong>
                        </span>
                      )}
                    </div>

                    {visit.message && (
                      <div className="visit-client-message">
                        "{visit.message}"
                      </div>
                    )}

                    <div className="visit-contact-info">
                      {isOwner ? (
                        <span>
                          👤 Demandeur :{" "}
                          <strong>{visit.client_name || "Client"}</strong>
                          {visit.client_phone && ` (📞 ${visit.client_phone})`}
                          {visit.client_email && ` • ✉️ ${visit.client_email}`}
                        </span>
                      ) : (
                        <span>
                          🏠 Propriétaire :{" "}
                          <strong>{visit.owner_name || "Propriétaire"}</strong>
                          {visit.owner_phone && ` (📞 ${visit.owner_phone})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions de gestion */}
                  <div className="visit-card-actions">
                    <Link
                      to={`/bien/${visit.property_id}`}
                      className="visit-btn-link"
                    >
                      👁️ Voir le bien
                    </Link>

                    {/* Actions Propriétaire / Admin */}
                    {isOwner && isPending && (
                      <>
                        <button
                          type="button"
                          className="visit-btn-confirm"
                          disabled={actionLoading === visit.id}
                          onClick={() =>
                            handleUpdateStatus(visit.id, "confirmee")
                          }
                        >
                          ✓ Confirmer la visite
                        </button>
                        <button
                          type="button"
                          className="visit-btn-cancel"
                          disabled={actionLoading === visit.id}
                          onClick={() =>
                            handleUpdateStatus(visit.id, "annulee")
                          }
                        >
                          ✕ Refuser
                        </button>
                      </>
                    )}

                    {isOwner && isConfirmed && (
                      <>
                        <button
                          type="button"
                          className="visit-btn-complete"
                          disabled={actionLoading === visit.id}
                          onClick={() =>
                            handleUpdateStatus(visit.id, "terminee")
                          }
                        >
                          🏁 Marquer comme terminée
                        </button>
                        <button
                          type="button"
                          className="visit-btn-cancel"
                          disabled={actionLoading === visit.id}
                          onClick={() =>
                            handleUpdateStatus(visit.id, "annulee")
                          }
                        >
                          ✕ Annuler
                        </button>
                      </>
                    )}

                    {/* Actions Client */}
                    {isClient && (isPending || isConfirmed) && (
                      <button
                        type="button"
                        className="visit-btn-cancel"
                        disabled={actionLoading === visit.id}
                        onClick={() =>
                          handleUpdateStatus(visit.id, "annulee")
                        }
                      >
                        🚫 Annuler ma visite
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
