import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { API_URL } from "../config/api";
import useSEO from "../utils/useSEO";

export default function ResetPassword() {
  useSEO({
    title: "Réinitialiser le mot de passe",
    noindex: true,
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      setMessage({ text: "Le mot de passe doit contenir au moins 8 caractères.", type: "error" });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: "Les deux mots de passe ne correspondent pas.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({
          text: data.message || "Le lien est invalide ou expiré. Demandez-en un nouveau.",
          type: "error",
        });
        return;
      }

      setMessage({ text: data.message, type: "success" });
      window.setTimeout(() => navigate("/connexion", { replace: true }), 1800);
    } catch (error) {
      console.error("Erreur réinitialisation du mot de passe :", error);
      setMessage({
        text: "Impossible de joindre le serveur. Réessayez plus tard.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B1528] text-[#D4AF37]">
          <LockKeyhole size={22} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choisissez un mot de passe d’au moins 8 caractères. Le lien de réinitialisation ne peut être utilisé qu’une seule fois.
        </p>

        {!token ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
            Le lien est incomplet. Demandez un nouveau lien depuis la page de connexion.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Nouveau mot de passe
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              />
            </div>

            {message.text && (
              <p
                role="alert"
                className={`rounded-xl border p-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {message.type === "success" && <CheckCircle2 className="mr-2 inline-block" size={16} />}
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#0B1528] px-4 py-3 font-bold text-white transition hover:bg-[#14223E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Enregistrement..." : "Réinitialiser le mot de passe"}
            </button>
          </form>
        )}

        <Link to="/connexion" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#0B1528]">
          <ArrowLeft size={16} />
          Retour à la connexion
        </Link>
      </section>
    </main>
  );
}
