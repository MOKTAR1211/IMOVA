import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { API_BASE_URL, API_URL } from "../config/api";
import "./NotificationCenter.css";

function NotificationCenter({ onUnreadCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    let active = true;

    async function loadNotifications() {
      try {
        const response = await fetch(`${API_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Erreur de chargement.");
        }

        if (active) setNotifications(data);
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    loadNotifications();

    const socket = io(API_BASE_URL, {
      auth: { token },
    });

    socket.on("notification:new", (notification) => {
      if (!active) return;

      setNotifications((previous) => [
        notification,
        ...previous.filter((item) => item.id !== notification.id),
      ].slice(0, 50));
    });

    socket.on("connect_error", (err) => {
      if (active) setError(err.message);
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, []);

  async function markAsRead(notification) {
    if (notification.is_read) return;

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notification.id}/read`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible de marquer comme lu.");
      }

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function markAllAsRead() {
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(
        `${API_URL}/notifications/read-all`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible de modifier les notifications.");
      }

      setNotifications((previous) =>
        previous.map((item) => ({ ...item, is_read: true }))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function openNotification(notification) {
    await markAsRead(notification);
    setOpen(false);

    if (notification.link?.startsWith("/")) {
      navigate(notification.link);
    }
  }

  return (
    <div className="notification-center">
      <button
        className="notification-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Notifications, ${unreadCount} non lues`}
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="notification-panel">
          <div className="notification-panel-header">
            <h2>Notifications</h2>

            {unreadCount > 0 && (
              <button type="button" onClick={markAllAsRead}>
                Tout lire
              </button>
            )}
          </div>

          {error && <p className="notification-error">{error}</p>}

          {notifications.length === 0 ? (
            <p className="notification-empty">
              Tu n'as pas encore de notifications.
            </p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={notification.is_read ? "" : "unread"}
                >
                  <button
                    type="button"
                    className="notification-item"
                    onClick={() => openNotification(notification)}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <small>
                      {new Date(notification.created_at).toLocaleString("fr-FR")}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default NotificationCenter;
