import React, { useEffect, useState, useCallback } from "react";
import { API_BASE_URL as API } from "../config/api";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  // ──────────────────────────────────────────────
  // Fetch helpers
  // ──────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("fetchNotifications:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnread(data.count);
      }
    } catch (err) {
      console.error("fetchUnread:", err);
    }
  }, [token]);

  // ──────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────
  const markAsRead = async (id) => {
    try {
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("markAsRead:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${API}/api/notifications/read-all/all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (err) {
      console.error("markAllAsRead:", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await fetch(`${API}/api/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnread((prev) =>
        Math.max(
          0,
          notifications.find((n) => n.id === id && !n.is_read) ? prev - 1 : prev
        )
      );
    } catch (err) {
      console.error("deleteNotification:", err);
    }
  };

  // ──────────────────────────────────────────────
  // Polling toutes les 10 secondes
  // ──────────────────────────────────────────────
  useEffect(() => {
    fetchNotifications();
    fetchUnread();

    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnread();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnread]);

  // ──────────────────────────────────────────────
  // Icône selon le type
  // ──────────────────────────────────────────────
  const typeIcon = (type) => {
    switch (type) {
      case "visit":    return "📅";
      case "property": return "🏠";
      case "message":  return "💬";
      default:         return "🔔";
    }
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  if (!token) {
    return (
      <div className="notifications-page">
        <p>Connectez-vous pour voir vos notifications.</p>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      {/* En-tête */}
      <div className="notifications-header">
        <h2>
          🔔 Notifications
          {unread > 0 && (
            <span className="notification-count">{unread}</span>
          )}
        </h2>

        {unread > 0 && (
          <button className="mark-all-btn" onClick={markAllAsRead}>
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <p className="notifications-empty">Chargement…</p>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          <span>🔕</span>
          <p>Aucune notification pour l'instant.</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notification ${n.is_read ? "read" : "unread"}`}
              onClick={() => !n.is_read && markAsRead(n.id)}
            >
              <div className="notification-icon">{typeIcon(n.type)}</div>

              <div className="notification-body">
                <h3 className="notification-title">{n.title}</h3>
                <p className="notification-message">{n.message}</p>
                <small className="notification-date">
                  {new Date(n.created_at).toLocaleString("fr-FR")}
                </small>
              </div>

              {/* Bouton supprimer */}
              <button
                className="notification-delete"
                title="Supprimer"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(n.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
