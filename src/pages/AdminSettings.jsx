import { useEffect, useState } from "react";
import { Bell, Check, KeyRound, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import AdminModuleLayout from "../components/AdminModuleLayout";
import useSEO from "../utils/useSEO";
import { API_URL } from "../config/api";
import "./AdminModules.css";

const emptyProfile = { first_name: "", last_name: "", email: "", phone: "", address: "" };
const emptyPassword = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function AdminSettings() {
  useSEO({ title: "Paramètres administrateur — IMOVA", noindex: true });
  const token = localStorage.getItem("token");
  const [profile, setProfile] = useState(emptyProfile);
  const [notifications, setNotifications] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [password, setPassword] = useState(emptyPassword);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_URL}/auth/profile`, { headers })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Impossible de charger le profil.");
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
        });
      })
      .catch((error) => setProfileError(error.message))
      .finally(() => setProfileLoading(false));

    fetch(`${API_URL}/notifications`, { headers })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Impossible de charger les notifications.");
        setNotifications(data);
      })
      .catch((error) => setNotificationError(error.message))
      .finally(() => setNotificationsLoading(false));
  }, [token]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible d'enregistrer le profil.");
      const updatedProfile = {
        ...profile,
        first_name: data.user.first_name || profile.first_name,
        last_name: data.user.last_name || profile.last_name,
        email: data.user.email || profile.email,
      };
      setProfile(updatedProfile);
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({
        ...storedUser,
        nom: data.user.nom || `${updatedProfile.first_name} ${updatedProfile.last_name}`.trim(),
        email: updatedProfile.email,
      }));
      setProfileMessage(data.message || "Profil mis à jour.");
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage("");
    setPasswordError("");
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(password),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de modifier le mot de passe.");
      setPassword(emptyPassword);
      setPasswordMessage(data.message || "Mot de passe modifié.");
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const markNotificationRead = async (notificationId) => {
    setNotificationError("");
    try {
      const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de mettre à jour la notification.");
      setNotifications((previous) => previous.map((item) => item.id === notificationId ? data.notification : item));
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  const markAllRead = async () => {
    setNotificationError("");
    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de mettre à jour les notifications.");
      setNotifications((previous) => previous.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <AdminModuleLayout
      title="Paramètres administrateur"
      eyebrow="PROFIL & SÉCURITÉ"
      description="Gérez les informations de votre compte, votre mot de passe et les notifications reçues par votre compte administrateur."
    >
      <div className="admin-settings-grid">
        <section className="admin-module-card">
          <div className="admin-module-card-heading">
            <div><span className="admin-module-kicker">IDENTITÉ DU COMPTE</span><h2><UserRound size={20} /> Profil administrateur</h2></div>
          </div>
          {profileMessage && <div className="admin-module-alert is-success" role="status">{profileMessage}</div>}
          {profileError && <div className="admin-module-alert is-error" role="alert">{profileError}</div>}
          {profileLoading ? <p className="admin-module-loading">Chargement du profil…</p> : (
            <form className="admin-settings-form" onSubmit={saveProfile}>
              <label>Prénom<input required maxLength="100" value={profile.first_name} onChange={(event) => setProfile({ ...profile, first_name: event.target.value })} /></label>
              <label>Nom<input required maxLength="100" value={profile.last_name} onChange={(event) => setProfile({ ...profile, last_name: event.target.value })} /></label>
              <label className="is-wide">Adresse e-mail<input required type="email" maxLength="150" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
              <label>Téléphone<input type="tel" maxLength="50" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
              <label>Adresse<input maxLength="250" value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></label>
              <button type="submit" className="admin-module-primary-button" disabled={savingProfile}><Save size={16} />{savingProfile ? "Enregistrement…" : "Enregistrer le profil"}</button>
            </form>
          )}
        </section>

        <section className="admin-module-card admin-security-card">
          <div className="admin-module-card-heading">
            <div><span className="admin-module-kicker">ACCÈS AU COMPTE</span><h2><LockKeyhole size={20} /> Sécurité</h2></div>
          </div>
          {passwordMessage && <div className="admin-module-alert is-success" role="status">{passwordMessage}</div>}
          {passwordError && <div className="admin-module-alert is-error" role="alert">{passwordError}</div>}
          <form className="admin-settings-password-form" onSubmit={changePassword}>
            <label>Mot de passe actuel<input type="password" autoComplete="current-password" required value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} /></label>
            <label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength="8" required value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></label>
            <label>Confirmer le nouveau mot de passe<input type="password" autoComplete="new-password" minLength="8" required value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} /></label>
            <p>La session et l'authentification restent gérées par le mécanisme sécurisé existant.</p>
            <button type="submit" className="admin-module-primary-button" disabled={savingPassword}><KeyRound size={16} />{savingPassword ? "Modification…" : "Modifier le mot de passe"}</button>
          </form>
          <div className="admin-security-note"><ShieldCheck size={17} /><span>Les opérations d'administration restent protégées par le contrôle du rôle côté serveur.</span></div>
        </section>

        <section className="admin-module-card admin-settings-notifications">
          <div className="admin-module-card-heading">
            <div><span className="admin-module-kicker">CENTRE DE NOTIFICATIONS</span><h2><Bell size={20} /> Notifications du compte</h2></div>
            {unreadCount > 0 && <button type="button" className="admin-module-secondary-button" onClick={markAllRead}><Check size={15} /> Tout marquer comme lu</button>}
          </div>
          <p className="admin-module-subdescription">Cette page gère les notifications en base de votre compte. Le projet ne propose pas encore de préférences d'envoi ni d'historique de connexion.</p>
          {notificationError && <div className="admin-module-alert is-error" role="alert">{notificationError}</div>}
          {notificationsLoading ? <p className="admin-module-loading">Chargement des notifications…</p> : notifications.length === 0 ? (
            <div className="admin-module-empty"><Bell size={24} /><strong>Aucune notification</strong><span>Les notifications adressées à votre compte apparaîtront ici.</span></div>
          ) : (
            <div className="admin-notification-list">
              {notifications.map((notification) => (
                <article key={notification.id} className={`admin-notification-item${notification.is_read ? "" : " is-unread"}`}>
                  <span className="admin-notification-indicator" />
                  <div><strong>{notification.title}</strong><p>{notification.message}</p><time>{new Date(notification.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time></div>
                  {!notification.is_read && <button type="button" onClick={() => markNotificationRead(notification.id)} aria-label={`Marquer « ${notification.title} » comme lue`}><Check size={16} /></button>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminModuleLayout>
  );
}
