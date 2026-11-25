import { useState } from "react";
import { API_URL } from "../config/api";
import "./ChangePassword.css";

function ChangePassword() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible de modifier le mot de passe.");
      }

      setMessage(data.message);
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-page">
      <section className="password-card">
        <h1>Changer mon mot de passe</h1>

        <p className="password-description">
          Protège ton compte IMOVA avec un mot de passe solide.
        </p>

        {message && <div className="password-success">{message}</div>}
        {error && <div className="password-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Mot de passe actuel
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </label>

          <label>
            Nouveau mot de passe
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label>
            Confirmer le nouveau mot de passe
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <p className="password-hint">
            Utilise au moins 8 caractères et évite les mots de passe faciles à deviner.
          </p>

          <button type="submit" disabled={loading}>
            {loading ? "Modification..." : "Modifier mon mot de passe"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ChangePassword;
