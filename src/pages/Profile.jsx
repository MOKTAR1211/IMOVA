import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL, API_URL } from "../config/api";
import "./Profile.css";

function Profile() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Connecte-toi pour accéder à ton profil.");
        }

        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Impossible de charger le profil.");
        }

        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
        });
        setPhotoPreview(data.profile_photo || "");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "La modification a échoué.");
      }

      setForm({
        first_name: data.user.first_name || "",
        last_name: data.user.last_name || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
        address: data.user.address || "",
      });

      // Mettre à jour l'utilisateur dans le localStorage si présent
      const localUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (localUser && localUser.id) {
        localUser.nom = data.user.nom || `${data.user.first_name} ${data.user.last_name}`.trim();
        localUser.email = data.user.email;
        localStorage.setItem("user", JSON.stringify(localUser));
      }

      setMessage(data.message || "Profil mis à jour avec succès.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Choisis une image JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 3 Mo.");
      return;
    }

    setError("");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto() {
    if (!photo) {
      setError("Sélectionne d'abord une photo.");
      return;
    }

    setUploadingPhoto(true);
    setError("");
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      formData.append("photo", photo);

      const response = await fetch(`${API_URL}/auth/profile/photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Échec de l'envoi.");
      }

      setPhotoPreview(data.profile_photo);
      setPhoto(null);
      setMessage(data.message || "Photo de profil mise à jour.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return <p className="profile-status">Chargement du profil...</p>;
  }

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div className="profile-heading">
          <div>
            <h1>Mon profil</h1>
            <p>Gère tes informations personnelles sur IMOVA.</p>
          </div>
        </div>

        <div className="profile-photo-section">
          {photoPreview ? (
            <img
              className="profile-photo"
              src={
                photoPreview.startsWith("blob:")
                  ? photoPreview
                  : photoPreview.startsWith("http")
                    ? photoPreview
                    : `${API_BASE_URL}${photoPreview}`
              }
              alt="Photo de profil"
            />
          ) : (
            <div className="profile-avatar">
              {form.first_name ? form.first_name.charAt(0).toUpperCase() : "U"}
            </div>
          )}

          <div className="profile-photo-actions">
            <label className="profile-upload-label">
              Choisir une photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
              />
            </label>

            <button
              type="button"
              onClick={uploadPhoto}
              disabled={!photo || uploadingPhoto}
            >
              {uploadingPhoto ? "Envoi..." : "Enregistrer la photo"}
            </button>
          </div>
        </div>

        {message && <p className="profile-success">{message}</p>}
        {error && <p className="profile-error">{error}</p>}

        <form onSubmit={handleSubmit} className="profile-form">
          <label>
            Prénom *
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Nom *
            <input
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Adresse e-mail *
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Téléphone
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Ex. : +229 01 00 00 00 00"
            />
          </label>

          <label className="profile-full-width">
            Adresse
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Ville, quartier..."
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </form>

        <div className="profile-security-link">
          <Link to="/change-password">
            Modifier mon mot de passe
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Profile;
