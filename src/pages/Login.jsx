import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Sparkles,
  Calendar,
  MapPin,
  HelpCircle,
  X
} from "lucide-react";
import { API_URL } from "../config/api";
import BrandLogo from "../components/BrandLogo";
import useSEO from "../utils/useSEO";
import "./Login.css";

export default function Login() {
  useSEO({
    title: "Connexion",
    description: "Connectez-vous à votre compte IMOVA pour retrouver vos annonces immobilières, vos favoris et vos échanges au Bénin.",
    noindex: true,
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Initialisation optimisée de l'état du formulaire dès le premier rendu
  const [form, setForm] = useState(() => {
    if (location.state?.verifiedEmail) {
      return {
        email: location.state.verifiedEmail,
        password: "",
      };
    }
    if (location.state?.registeredEmail) {
      return {
        email: location.state.registeredEmail,
        password: location.state.registeredPassword || "",
      };
    }
    const savedEmail = localStorage.getItem("immo229_remembered_email");
    if (savedEmail) {
      return { email: savedEmail, password: "" };
    }
    const oldLegacy = localStorage.getItem("immo229_remembered_credentials");
    if (oldLegacy) {
      try {
        const parsed = JSON.parse(oldLegacy);
        if (parsed.email) {
          return { email: parsed.email, password: "" };
        }
      } catch {
        // Ignoré
      }
    }
    return { email: "", password: "" };
  });

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return Boolean(
      localStorage.getItem("immo229_remembered_email") ||
      localStorage.getItem("immo229_remembered_credentials")
    );
  });
  const [message, setMessage] = useState(() => {
    if (location.state?.verifiedEmail) {
      return {
        text: "Adresse e-mail confirmée. Vous pouvez maintenant vous connecter.",
        type: "success",
      };
    }
    if (location.state?.registeredEmail) {
      const roleText =
        location.state.role === "proprietaire" ? "Propriétaire" : "Client";
      return {
        text: `Compte ${roleText} prêt ! Cliquez sur « Se connecter » pour accéder à votre espace.`,
        type: "success",
      };
    }
    return { text: "", type: "" };
  });
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState({ text: "", type: "" });

  // Nettoyage de sécurité proactif si un mot de passe en clair résidait dans l'ancien stockage
  useEffect(() => {
    const oldLegacy = localStorage.getItem("immo229_remembered_credentials");
    if (oldLegacy) {
      try {
        const parsed = JSON.parse(oldLegacy);
        if (parsed.email && !localStorage.getItem("immo229_remembered_email")) {
          localStorage.setItem("immo229_remembered_email", parsed.email);
        }
      } catch {
        // Ignoré
      }
      localStorage.removeItem("immo229_remembered_credentials");
    }
  }, []);

  // Fermeture du modal Mot de passe oublié via la touche Échap
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && showForgotModal) {
        setShowForgotModal(false);
      }
    },
    [showForgotModal]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (message.text) {
      setMessage({ text: "", type: "" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation côté client sans fuite d'informations sensibles
    if (!form.email.trim()) {
      setMessage({
        text: "Veuillez saisir votre adresse e-mail.",
        type: "error",
      });
      return;
    }

    if (!form.password) {
      setMessage({
        text: "Veuillez saisir votre mot de passe.",
        type: "error",
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPendingVerification(data.code === "EMAIL_NOT_VERIFIED");
        setMessage({
          text: data.message || "Identifiants invalides. Veuillez vérifier votre adresse e-mail et mot de passe.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      setPendingVerification(false);
      // Sauvegarde sécurisée de la session (token JWT + profil public)
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Gestion de l'option « Se souvenir de moi » : on ne sauvegarde QUE l'e-mail, JAMAIS le mot de passe
      if (rememberMe) {
        localStorage.setItem("immo229_remembered_email", form.email.trim());
      } else {
        localStorage.removeItem("immo229_remembered_email");
      }
      localStorage.removeItem("immo229_remembered_credentials");

      setMessage({
        text: `Connexion réussie ! Bienvenue ${data.user?.nom || ""}`,
        type: "success",
      });

      // Navigation fluide vers la destination appropriée
      setTimeout(() => {
        if (data.user?.role === "admin") {
          navigate("/admin");
        } else if (data.user?.role === "proprietaire") {
          navigate("/property-dashboard");
        } else {
          const destination = location.state?.from || "/dashboard";
          navigate(
            destination,
            location.state?.startContactPayment
              ? { state: { startContactPayment: true } }
              : undefined
          );
        }
      }, 700);

    } catch (error) {
      console.error("Erreur de connexion :", error);
      setMessage({
        text: "Impossible de joindre le serveur. Assurez-vous que le service est bien accessible.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setMessage({ text: "", type: "" });
    try {
      const response = await fetch(`${API_URL}/auth/resend-verification-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.message || "Impossible de renvoyer le code.", type: "error" });
        return;
      }
      navigate("/inscription", {
        state: {
          verificationPending: true,
          verificationEmail: form.email.trim().toLowerCase(),
        },
      });
    } catch (error) {
      console.error("Erreur renvoi code de confirmation :", error);
      setMessage({ text: "Impossible de contacter le serveur. Réessayez.", type: "error" });
    } finally {
      setResendingVerification(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotMessage({ text: "Saisissez votre adresse e-mail.", type: "error" });
      return;
    }

    setForgotLoading(true);
    setForgotMessage({ text: "", type: "" });
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await response.json();
      setForgotMessage({
        text: response.ok
          ? data.message
          : data.message || "Impossible de traiter la demande pour le moment.",
        type: response.ok ? "success" : "error",
      });
    } catch (error) {
      console.error("Erreur demande de réinitialisation :", error);
      setForgotMessage({
        text: "Impossible de joindre le serveur. Réessayez plus tard.",
        type: "error",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#070D1E] font-sans overflow-x-hidden text-slate-800">
      
      {/* =========================================================================
          PARTIE 1 (DESKTOP) : VISUEL IMMOBILIER DE PRESTIGE & VALEURS IMOVA
          ========================================================================= */}
      <section 
        aria-label="Présentation IMOVA"
        className="hidden lg:flex lg:w-1/2 xl:w-5/12 bg-[#070D1E] relative flex-col justify-between p-10 xl:p-14 text-white overflow-hidden select-none"
      >
        {/* Photo d'architecture immobilière haut de gamme */}
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=85"
          alt="Villa contemporaine entourée de verdure"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.70] contrast-[1.08] transition-transform duration-1000 hover:scale-105"
        />

        {/* Superposition bleu nuit & lueurs or discret */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070D1E] via-[#0B1528]/85 to-[#070D1E]/65 pointer-events-none" />
        <div className="absolute top-1/4 -left-16 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* En-tête du volet visuel : Logo & Lien retour */}
        <div className="relative z-10 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#C5A059] rounded-xl p-1"
            title="Retour à la page d'accueil"
          >
            <BrandLogo variant="white" className="h-auto w-[220px] max-w-[52vw] transition-opacity group-hover:opacity-90" />
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-medium text-slate-200 hover:text-white transition-all backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Accueil</span>
          </Link>
        </div>

        {/* Présentation des fonctionnalités d'IMOVA */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold tracking-wide uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            Plateforme Immobilière au Bénin
          </div>

          <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight tracking-tight mb-4">
            « Trouvez le bien qui vous ressemble »
          </h2>

          <p className="text-sm xl:text-base text-slate-300 leading-relaxed max-w-lg mb-8">
            Consultez les annonces, comparez les informations publiées et échangez avec les propriétaires depuis votre espace.
          </p>

          <ul className="space-y-3.5 text-xs xl:text-sm text-slate-200">
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
                <span>Des annonces avec leurs détails et leurs photos</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span>Demandes de visite et suivi depuis votre espace</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span>Localisation sur carte lorsqu'elle est renseignée</span>
            </li>
          </ul>
        </div>

        {/* Fonctions disponibles sur la plateforme */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <div>
            <p className="font-bold text-white text-base">Recherche</p>
            <p className="text-[11px] text-slate-400">Par commune et budget</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <p className="font-bold text-white text-base">Espace personnel</p>
            <p className="text-[11px] text-slate-400">Pour clients et propriétaires</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <p className="font-bold text-white text-base">Mise en relation</p>
            <p className="text-[11px] text-slate-400">Messages et demandes de visite</p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PARTIE 2 : FORMULAIRE DE CONNEXION (DESKTOP & MOBILE)
          ========================================================================= */}
      <main className="w-full lg:w-1/2 xl:w-7/12 min-h-screen flex flex-col justify-between bg-white px-5 sm:px-10 md:px-14 xl:px-20 py-8 sm:py-12 relative overflow-y-auto">
        
        {/* En-tête mobile : Logo & Slogan pour écrans < lg */}
        <div className="lg:hidden flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo className="h-auto w-[178px] max-w-[52vw]" />
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#0B1528] px-3 py-1.5 rounded-lg border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Accueil</span>
          </Link>
        </div>

        {/* Conteneur centré du formulaire */}
        <div className="max-w-md w-full mx-auto my-auto animate-fade-in-up">
          
          {/* Badge & Titre de bienvenue */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B1528]/5 border border-[#C5A059]/30 text-[#0B1528] text-xs font-bold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-[#C5A059]"></span>
              Espace client et propriétaire
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-[#0B1528] tracking-tight">
              Bon retour !
            </h1>

            <p className="text-sm sm:text-base text-slate-500 mt-2 leading-relaxed">
              Connectez-vous à votre compte IMOVA pour gérer vos biens, vos visites et vos échanges.
            </p>
          </div>

          {/* Message de notification / alerte */}
          {message.text && (
            <div
              role="alert"
              aria-live="polite"
              className={`p-4 rounded-xl mb-6 text-xs sm:text-sm font-semibold flex items-start gap-3 transition-all ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-snug">{message.text}</span>
            </div>
          )}
          {pendingVerification && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="mb-6 text-sm font-bold text-emerald-800 underline underline-offset-2 disabled:opacity-60"
            >
              {resendingVerification ? "Envoi du code..." : "Renvoyer le code de confirmation"}
            </button>
          )}

          {/* Formulaire de connexion */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            
            {/* Champ Adresse e-mail */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
              >
                Adresse e-mail
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  placeholder="ex. client@exemple.bj"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="username"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all duration-200 bg-white hover:border-slate-400 focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/15 shadow-2xs"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Champ Mot de passe avec bouton oeil */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Votre mot de passe"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all duration-200 bg-white hover:border-slate-400 focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/15 shadow-2xs"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0B1528] focus:text-[#0B1528] focus:outline-none transition-colors p-1 rounded-md"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Rangée : Se souvenir de moi & Mot de passe oublié */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-xs sm:text-sm">
              <label
                htmlFor="remember-me"
                className="flex items-center gap-2.5 cursor-pointer select-none text-slate-600 hover:text-[#0B1528] transition-colors"
              >
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0B1528] accent-[#0B1528] border-slate-300 focus:ring-[#C5A059] cursor-pointer"
                />
                <span className="font-medium">Se souvenir de moi</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setForgotEmail(form.email);
                  setForgotMessage({ text: "", type: "" });
                  setShowForgotModal(true);
                }}
                className="font-semibold text-slate-600 hover:text-[#C5A059] hover:underline transition-colors cursor-pointer focus:outline-none"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Bouton principal de soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl immo-btn-primary font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-[#D4AF37]" />
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>

          {/* Lien vers la création de compte */}
          <div className="mt-8 text-center text-xs sm:text-sm text-slate-600">
            Vous n'avez pas encore de compte ?{" "}
            <Link
              to="/inscription"
              className="font-bold text-[#0B1528] hover:text-[#C5A059] inline-flex items-center gap-1 underline decoration-[#C5A059]/40 underline-offset-4 hover:decoration-[#C5A059] transition-colors ml-1"
            >
              Créer un compte <ArrowRight className="w-3.5 h-3.5 text-[#C5A059]" />
            </Link>
          </div>

        </div>

        {/* Pied de page du formulaire */}
        <footer className="pt-6 mt-8 border-t border-slate-100 text-center text-xs text-slate-400">
          <p>© 2026 IMOVA • Plateforme immobilière au Bénin. Tous droits réservés.</p>
        </footer>
      </main>

      {/* =========================================================================
      MODAL : DEMANDE DE RÉINITIALISATION DU MOT DE PASSE
          ========================================================================= */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1E]/70 immo-modal-backdrop animate-fade-in-up"
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton de fermeture */}
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              aria-label="Fermer la boîte de dialogue"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-[#0B1528] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* En-tête du modal */}
            <div className="w-12 h-12 rounded-xl bg-[#0B1528] border border-[#C5A059]/40 flex items-center justify-center text-[#D4AF37] mb-4 shadow-md">
              <HelpCircle className="w-6 h-6" />
            </div>

            <h3 id="forgot-password-title" className="text-xl font-black text-[#0B1528] mb-2">
              Mot de passe oublié ?
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
              Saisissez l’adresse e-mail associée à votre compte. Si elle existe, vous recevrez un lien sécurisé valable 30 minutes.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <label htmlFor="forgot-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Adresse e-mail
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20"
                placeholder="ex. client@exemple.bj"
              />

              {forgotMessage.text && (
                <p
                  role="alert"
                  className={`rounded-xl border p-3 text-xs ${
                    forgotMessage.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {forgotMessage.text}
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl immo-btn-primary font-bold text-xs sm:text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {forgotLoading ? "Envoi en cours..." : "Envoyer le lien"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
