import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  House,
  KeyRound,
  Mail,
  MapPin,
  UserRound,
  UsersRound,
} from "lucide-react";
import { API_URL } from "../config/api";
import useSEO from "../utils/useSEO";
import BrandLogo from "../components/BrandLogo";
import "./Register.css";

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  useSEO({
    title: "Créer un compte",
    description: "Créez votre compte IMOVA pour trouver un logement ou publier un bien immobilier au Bénin.",
    noindex: true,
  });

  const [form, setForm] = useState({
    nom: "",
    email: "",
    password: "",
    role: location.state?.role || "client",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(() => (
    location.state?.verificationPending
      ? { text: "Saisissez le code envoyé à votre adresse e-mail pour activer votre compte.", type: "success" }
      : { text: "", type: "" }
  ));
  const [loading, setLoading] = useState(false);
  const [verificationMode, setVerificationMode] = useState(Boolean(location.state?.verificationPending));
  const [verificationEmail, setVerificationEmail] = useState(location.state?.verificationEmail || "");
  const [codeEmailSent, setCodeEmailSent] = useState(Boolean(location.state?.verificationPending));
  const [verificationCode, setVerificationCode] = useState("");

  const handleChange = (e) => {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
    if (message.text) setMessage({ text: "", type: "" });
  };

  const handleRoleSelect = (selectedRole) => {
    setForm((current) => ({
      ...current,
      role: selectedRole,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (verificationMode) {
      try {
        const response = await fetch(`${API_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: verificationEmail, code: verificationCode }),
        });
        const data = await response.json();

        if (!response.ok) {
          setMessage({ text: data.message || "Impossible de confirmer cette adresse e-mail.", type: "error" });
          return;
        }

        navigate("/connexion", {
          state: { verifiedEmail: verificationEmail, role: form.role },
        });
      } catch (error) {
        console.error("Erreur confirmation e-mail :", error);
        setMessage({ text: "Impossible de contacter le serveur. Réessayez.", type: "error" });
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "EMAIL_SEND_FAILED" && data.email) {
          setVerificationEmail(data.email);
          setVerificationMode(true);
          setCodeEmailSent(false);
        }
        setMessage({
          text: data.message || "Erreur lors de la création du compte.",
          type: "error",
        });
        return;
      }

      setVerificationEmail(form.email.trim().toLowerCase());
      setVerificationMode(true);
      setCodeEmailSent(true);
      setMessage({
        text: "Compte créé. Saisissez le code à 6 chiffres envoyé par e-mail pour activer votre compte.",
        type: "success",
      });

    } catch (error) {
      console.error("Erreur register:", error);
      setMessage({
        text: "Impossible de contacter le serveur. Vérifiez votre connexion.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      const response = await fetch(`${API_URL}/auth/resend-verification-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.message || "Impossible de renvoyer le code.", type: "error" });
        return;
      }
      setCodeEmailSent(true);
      setMessage({ text: "Si le compte attend une confirmation, un nouveau code vient d'être envoyé.", type: "success" });
    } catch (error) {
      console.error("Erreur renvoi code de confirmation :", error);
      setMessage({ text: "Impossible de contacter le serveur. Réessayez.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-screen">
      <section className="register-story" aria-label="Présentation d'IMOVA">
        <img
          className="register-story-image"
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=85"
          alt="Maison contemporaine entourée de verdure"
        />
        <div className="register-story-overlay" />
        <div className="register-story-top">
          <Link to="/" className="register-brand">
            <BrandLogo variant="white" className="register-brand__logo" />
          </Link>
          <span className="register-country">BÉNIN <span>🇧🇯</span></span>
        </div>
        <div className="register-story-copy">
          <span className="register-story-kicker"><span /> VOTRE PROJET COMMENCE ICI</span>
          <h2>Votre recherche immobilière <em>commence ici.</em></h2>
          <p>Consultez les annonces, publiez un bien ou prenez contact avec son propriétaire depuis IMOVA.</p>
          <div className="register-story-points">
            <span><Building2 size={17} /> Des annonces avec leurs informations</span>
            <span><MapPin size={17} /> Une recherche par commune</span>
            <span><UsersRound size={17} /> Un espace adapté à votre profil</span>
          </div>
        </div>
        <div className="register-story-footer">
          <span>IMOVA</span>
          <span>Recherche et annonces immobilières au Bénin</span>
        </div>
      </section>

      <section className="register-panel">
        <div className="register-mobile-brand">
          <Link to="/" className="register-brand">
            <BrandLogo className="register-brand__logo" />
          </Link>
          <Link to="/" className="register-home-link"><ArrowLeft size={15} /> Accueil</Link>
        </div>

        <div className="register-content">
          <div className="register-overline">INSCRIPTION GRATUITE</div>
          <h1>{verificationMode ? "Confirmez votre e-mail" : "Créez votre compte"}</h1>
          <p className="register-intro">
            {verificationMode
              ? "Cette étape sécurise votre compte et confirme que vous avez accès à cette adresse."
              : "Créez un compte client pour rechercher un bien, ou propriétaire pour publier une annonce."}
          </p>

          <form className="register-form" onSubmit={handleSubmit} method="POST">
            {verificationMode ? (
              <>
                <p className="register-verification-copy">
                  {codeEmailSent
                    ? <>Nous avons envoyé un code de confirmation à <strong>{verificationEmail}</strong>. Il expire après 10 minutes.</>
                    : <>L'envoi du code a échoué pour <strong>{verificationEmail}</strong>. Vous pouvez réessayer ci-dessous.</>}
                </p>
                <div className="register-field">
                  <label htmlFor="register-verification-code">Code de confirmation</label>
                  <div className="register-input-wrap">
                    <Mail size={17} aria-hidden="true" />
                    <input
                      id="register-verification-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(event) => {
                        setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                        if (message.text) setMessage({ text: "", type: "" });
                      }}
                      aria-describedby="register-verification-help"
                      required
                    />
                  </div>
                  <small id="register-verification-help" className="register-field-help">
                    Consultez votre boîte de réception et vos courriers indésirables.
                  </small>
                </div>
                {message.text && (
                  <p className={`register-message is-${message.type}`} role={message.type === "error" ? "alert" : "status"}>
                    {message.text}
                  </p>
                )}
                <button type="submit" className="register-submit" disabled={loading}>
                  {loading ? "Vérification..." : "Confirmer mon adresse"}
                  {!loading && <ArrowRight size={17} />}
                </button>
                <button
                  type="button"
                  className="register-resend"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  Renvoyer le code
                </button>
              </>
            ) : (
              <>
            <fieldset className="register-role-fieldset">
              <legend>Comment souhaitez-vous utiliser IMOVA ?</legend>
              <div className="register-role-options">
                <button
                  type="button"
                  className={`register-role-option${form.role === "client" ? " is-selected" : ""}`}
                  onClick={() => handleRoleSelect("client")}
                  aria-pressed={form.role === "client"}
                >
                  <span className="register-role-icon"><UserRound size={20} /></span>
                  <span className="register-role-copy"><strong>Je cherche un bien</strong><small>Client · acheteur ou locataire</small></span>
                  <span className="register-role-check">{form.role === "client" && <Check size={13} />}</span>
                </button>
                <button
                  type="button"
                  className={`register-role-option${form.role === "proprietaire" ? " is-selected" : ""}`}
                  onClick={() => handleRoleSelect("proprietaire")}
                  aria-pressed={form.role === "proprietaire"}
                >
                  <span className="register-role-icon"><House size={20} /></span>
                  <span className="register-role-copy"><strong>Je propose un bien</strong><small>Propriétaire · bailleur</small></span>
                  <span className="register-role-check">{form.role === "proprietaire" && <Check size={13} />}</span>
                </button>
              </div>
              <p className="register-role-hint">
                {form.role === "proprietaire"
                  ? "Publiez et gérez vos annonces immobilières depuis votre espace propriétaire."
                  : "Enregistrez vos favoris et organisez vos visites depuis votre espace client."}
              </p>
            </fieldset>

            <div className="register-field">
              <label htmlFor="register-nom">Nom complet</label>
              <div className="register-input-wrap">
                <UserRound size={17} aria-hidden="true" />
                <input
                  id="register-nom"
                  type="text"
                  name="nom"
                  placeholder="Ex. Koffi Mensah"
                  value={form.nom}
                  onChange={handleChange}
                  autoComplete="name"
                  minLength={2}
                  required
                />
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="register-email">Adresse e-mail</label>
              <div className="register-input-wrap">
                <Mail size={17} aria-hidden="true" />
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  placeholder="vous@exemple.bj"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="register-password">Mot de passe</label>
              <div className="register-input-wrap">
                <KeyRound size={17} aria-hidden="true" />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Au moins 6 caractères"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <small className="register-field-help">Choisissez un mot de passe que vous n’utilisez pas ailleurs.</small>
            </div>

            {message.text && (
              <p className={`register-message is-${message.type}`} role={message.type === "error" ? "alert" : "status"}>
                {message.text}
              </p>
            )}

            <button type="submit" className="register-submit" disabled={loading}>
              {loading ? "Création du compte..." : "Créer mon compte"}
              {!loading && <ArrowRight size={17} />}
            </button>
              </>
            )}
          </form>

          <p className="register-login-prompt">
            Vous avez déjà un compte ? <Link to="/connexion">Se connecter</Link>
          </p>
          <p className="register-terms">
            En créant un compte, vous acceptez de fournir des informations exactes pour utiliser IMOVA.
          </p>
        </div>
        <footer className="register-panel-footer">© 2026 IMOVA · L’immobilier au Bénin</footer>
      </section>
    </main>
  );
}

export default Register;
