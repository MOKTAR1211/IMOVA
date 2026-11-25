import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import BrandLogo from "./BrandLogo";
import NotificationCenter from "./NotificationCenter";
import "./AdminModuleLayout.css";

const links = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/admin/payments", label: "Paiements", icon: CreditCard },
  { to: "/admin/messages", label: "Signalements de messages", icon: MessageCircle },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

export default function AdminModuleLayout({ title, eyebrow, description, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  return (
    <div className="admin-module">
      {menuOpen && (
        <button
          type="button"
          className="admin-module-backdrop"
          aria-label="Fermer le menu administrateur"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`admin-module-sidebar${menuOpen ? " is-open" : ""}`}>
        <Link to="/admin" className="admin-module-brand" onClick={() => setMenuOpen(false)}>
          <BrandLogo variant="symbol" className="admin-module-mark" />
          <BrandLogo variant="white" className="admin-module-wordmark" />
        </Link>
        <button
          type="button"
          className="admin-module-close"
          aria-label="Fermer le menu administrateur"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <p className="admin-module-label">ESPACE ADMINISTRATEUR</p>
        <nav className="admin-module-nav" aria-label="Navigation administrateur">
          {links.map(({ to, label, icon: Icon, end }) => {
            const active = end
              ? location.pathname === to
              : location.pathname === to || location.pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={active ? "is-active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-module-secure">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Accès protégé par le rôle administrateur</span>
        </div>
        <div className="admin-module-account">
          <span className="admin-module-avatar">{(user?.nom || "A").trim().charAt(0).toUpperCase()}</span>
          <span><strong>{user?.nom || "Administrateur"}</strong><small>Administrateur</small></span>
          <button type="button" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="admin-module-main">
        <header className="admin-module-topbar">
          <button
            type="button"
            className="admin-module-menu-toggle"
            aria-label="Ouvrir le menu administrateur"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="admin-module-heading">
            <span>{eyebrow}</span>
            <h1>{title}</h1>
          </div>
          <NotificationCenter />
        </header>
        <div className="admin-module-content">
          <p className="admin-module-description">{description}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
