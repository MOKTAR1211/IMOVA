import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CreditCard,
  Eye,
  Heart,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import NotificationCenter from "../components/NotificationCenter";
import { API_URL } from "../config/api";
import BrandLogo from "../components/BrandLogo";
import "./PropertyDashboard.css";

const EMPTY_STATS = {
  total: 0,
  en_attente: 0,
  disponibles: 0,
  loues: 0,
  vendus: 0,
  rejete: 0,
};

const defaultPropertyImage =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

async function fetchJson(path, token) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Impossible de charger ces informations.");
  }

  return data;
}

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `${amount.toLocaleString("fr-FR")} FCFA`
    : "Prix sur demande";
}

function getPropertyImage(property) {
  return property.image_url || property.image || defaultPropertyImage;
}

function getVisitDateTime(visit) {
  const date = String(visit.visit_date || "").slice(0, 10);
  const time = String(visit.visit_time || "00:00").slice(0, 5);
  return new Date(`${date}T${time}`);
}

function formatVisitDate(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "P";
}

function StatCard({ icon: Icon, tone, title, value, note, link, index }) {
  return (
    <article
      className={`owner-stat-card owner-stat-card--${tone}`}
      style={{ "--card-index": index }}
    >
      <div className="owner-stat-card__top">
        <span className="owner-stat-card__icon"><Icon size={20} strokeWidth={1.8} /></span>
        <span className="owner-stat-card__trend">
          {value === null ? <CircleHelp size={14} /> : <Check size={14} />}
          {note}
        </span>
      </div>
      <strong className="owner-stat-card__value">{value === null ? "—" : value}</strong>
      <div className="owner-stat-card__bottom">
        <div>
          <h2>{title}</h2>
          <Link to={link}>Voir le détail <ArrowUpRight size={13} /></Link>
        </div>
        <svg className="owner-stat-sparkline" viewBox="0 0 76 30" aria-hidden="true">
          <path d="M2 23 C12 22 13 12 23 16 S37 24 45 14 S58 7 74 3" />
        </svg>
      </div>
    </article>
  );
}

function PropertyPreview({ property, views, activity }) {
  const title = property.title || property.titre || "Bien immobilier";
  const status = (property.status || "disponible").toLowerCase();
  const statusLabel = status === "vendu" ? "Vendu" : status === "loue" ? "Loué" : "Disponible";
  const paymentStatus = String(property.publication_payment_status || "").toLowerCase();
  const paymentLabel = paymentStatus === "paid"
    ? "Publication réglée"
    : paymentStatus === "pending"
      ? "Paiement en attente"
      : "";

  return (
    <article className="owner-property-preview">
      <Link to={`/properties/${property.id}`} className="owner-property-preview__image">
        <img src={getPropertyImage(property)} alt={title} loading="lazy" />
        <span className={`owner-property-status owner-property-status--${status}`}>
          <span />{statusLabel}
        </span>
      </Link>
      <div className="owner-property-preview__copy">
        <div>
          <h3><Link to={`/properties/${property.id}`}>{title}</Link></h3>
          <p>{property.city || property.ville || property.location || "Bénin"}</p>
        </div>
        {paymentLabel && (
          <span className={`owner-property-payment${paymentStatus === "paid" ? " is-paid" : ""}`}>
            {paymentLabel}
          </span>
        )}
      </div>
      <strong className="owner-property-preview__price">
        {formatPrice(property.price ?? property.prix)}
      </strong>
      <div className="owner-property-metrics">
        <span><Eye size={13} /> {views ?? "—"} vues</span>
        <span><Heart size={13} /> — favoris</span>
        <span><CalendarDays size={13} /> {activity?.total_visites ?? 0} visites</span>
      </div>
      <div className="owner-property-actions">
        <Link to={`/modifier-bien/${property.id}`}>Modifier</Link>
        <Link to={`/properties/${property.id}`}>Voir</Link>
        <Link to="/activity-stats">Gérer</Link>
      </div>
    </article>
  );
}

export default function PropertyDashboard() {
  const navigate = useNavigate();
  const [user] = useState(readStoredUser);
  const [now] = useState(() => new Date());
  const [currentYear] = useState(() => new Date().getFullYear());
  const [stats, setStats] = useState(EMPTY_STATS);
  const [properties, setProperties] = useState([]);
  const [activity, setActivity] = useState(null);
  const [propertyViews, setPropertyViews] = useState([]);
  const [visits, setVisits] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [sectionErrors, setSectionErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAllVisits, setShowAllVisits] = useState(false);

  const name = user?.nom || user?.name || "Propriétaire";
  const firstName = name.trim().split(/\s+/)[0] || "Propriétaire";
  const unreadMessages = conversations.reduce(
    (total, conversation) => total + (Number(conversation.unreadCount) || 0),
    0
  );

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem("token");
    const requests = await Promise.allSettled(token
      ? [
        fetchJson("/properties/stats/dashboard", token),
        fetchJson("/properties/mine", token),
        fetchJson("/visits/my-visits", token),
        fetchJson("/messages/conversations", token),
        fetchJson("/properties/stats/activity", token),
        fetchJson("/properties/stats/views", token),
      ]
      : Array.from({ length: 6 }, () =>
        Promise.reject(new Error("Connectez-vous pour accéder à votre espace propriétaire."))
      ));

    const [statsResult, propertiesResult, visitsResult, conversationsResult, activityResult, viewsResult] = requests;
    if (statsResult.status === "rejected") {
      setError(statsResult.reason.message || "Impossible de charger le tableau de bord.");
    } else {
      setStats({ ...EMPTY_STATS, ...statsResult.value });
    }

    const errors = {};
    if (propertiesResult.status === "fulfilled") {
      setProperties(Array.isArray(propertiesResult.value) ? propertiesResult.value : []);
    } else {
      errors.properties = propertiesResult.reason.message;
    }
    if (visitsResult.status === "fulfilled") {
      setVisits(Array.isArray(visitsResult.value) ? visitsResult.value : []);
    } else {
      errors.visits = visitsResult.reason.message;
    }
    if (conversationsResult.status === "fulfilled") {
      setConversations(Array.isArray(conversationsResult.value) ? conversationsResult.value : []);
    } else {
      errors.messages = conversationsResult.reason.message;
    }
    if (activityResult.status === "fulfilled") {
      setActivity(activityResult.value);
    } else {
      errors.activity = activityResult.reason.message;
    }
    if (viewsResult.status === "fulfilled") {
      setPropertyViews(Array.isArray(viewsResult.value) ? viewsResult.value : []);
    } else {
      errors.views = viewsResult.reason.message;
    }
    setSectionErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadDashboard();
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    document.body.classList.toggle("owner-dashboard-open", mobileMenuOpen);
    return () => document.body.classList.remove("owner-dashboard-open");
  }, [mobileMenuOpen]);

  const upcomingVisits = useMemo(() => {
    return visits
      .map((visit) => ({ ...visit, dashboardDate: getVisitDateTime(visit) }))
      .filter((visit) => (
        visit.dashboardDate >= now &&
        !["annulee", "cancelled", "rejected", "terminee"].includes(
          String(visit.status || "").toLowerCase()
        )
      ))
      .sort((a, b) => a.dashboardDate - b.dashboardDate);
  }, [now, visits]);

  const recentProperties = useMemo(() => properties.slice(0, 3), [properties]);
  const recentConversations = useMemo(() => conversations.slice(0, 4), [conversations]);
  const visibleVisits = showAllVisits ? upcomingVisits : upcomingVisits.slice(0, 3);
  const performanceData = useMemo(() => {
    const activityById = new Map(
      (activity?.annonces || []).map((property) => [String(property.id), property])
    );
    const viewsById = new Map(
      propertyViews.map((property) => [String(property.id), property])
    );
    return properties.slice(0, 6).map((property) => {
      const id = String(property.id);
      const propertyActivity = activityById.get(id);
      const propertyView = viewsById.get(id);
      return {
        name: property.title || property.titre || "Bien immobilier",
        vues: Number(propertyView?.total_views) || 0,
        visites: Number(propertyActivity?.total_visites) || 0,
        demandes: Number(propertyActivity?.total_contacts) || 0,
      };
    });
  }, [activity, properties, propertyViews]);

  const statCards = [
    { title: "Total des biens", value: Number(stats.total) || 0, note: "Votre portefeuille", icon: Building2, tone: "blue", link: "/my-properties" },
    { title: "Biens disponibles", value: Number(stats.disponibles) || 0, note: "Prêts à accueillir", icon: Home, tone: "teal", link: "/my-properties" },
    { title: "Visites à venir", value: upcomingVisits.length, note: "Demandes planifiées", icon: CalendarDays, tone: "gold", link: "#upcoming-visits" },
    { title: "Revenus", value: null, note: "Données indisponibles", icon: CreditCard, tone: "violet", link: "/property-charts" },
  ];

  const handleSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/biens?keyword=${encodeURIComponent(query)}` : "/biens");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  if (loading && !stats.total && !properties.length && !error) {
    return (
      <div className="owner-dashboard-loading">
        <span className="owner-dashboard-spinner" />
        <p>Préparation de votre espace propriétaire…</p>
      </div>
    );
  }

  if (error && !stats.total && !properties.length) {
    return (
      <div className="owner-dashboard-error">
        <CircleHelp size={32} />
        <h1>Votre espace n’est pas disponible</h1>
        <p>{error}</p>
        <div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              loadDashboard();
            }}
          >
            Réessayer
          </button>
          <Link to="/connexion">Se connecter</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-dashboard">
      {mobileMenuOpen && (
        <button
          type="button"
          className="owner-dashboard-backdrop"
          aria-label="Fermer le menu"
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`owner-sidebar${mobileMenuOpen ? " is-open" : ""}`}>
        <Link to="/" className="owner-brand" onClick={closeMobileMenu}>
          <BrandLogo variant="white" className="owner-brand__logo" />
        </Link>
        <button
          type="button"
          className="owner-sidebar-close"
          aria-label="Fermer le menu"
          onClick={closeMobileMenu}
        >
          <X size={20} />
        </button>

        <p className="owner-sidebar-label">ESPACE PROPRIÉTAIRE</p>
        <nav className="owner-sidebar-nav" aria-label="Navigation propriétaire">
          <Link to="/property-dashboard" className="is-active" onClick={closeMobileMenu}>
            <Home size={18} /><span>Tableau de bord</span>
          </Link>
          <Link to="/my-properties" onClick={closeMobileMenu}>
            <Building2 size={18} /><span>Mes biens</span>
          </Link>
          <Link to="/ajouter-bien" onClick={closeMobileMenu}>
            <Plus size={18} /><span>Ajouter un bien</span>
          </Link>
          <a href="#upcoming-visits" onClick={closeMobileMenu}>
            <CalendarDays size={18} /><span>Visites</span>
            {upcomingVisits.length > 0 && <span className="owner-nav-badge">{upcomingVisits.length}</span>}
          </a>
          <Link to="/messages" onClick={closeMobileMenu}>
            <MessageCircle size={18} /><span>Messages</span>
            {unreadMessages > 0 && <span className="owner-nav-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
          </Link>
          <Link to="/activity-stats" onClick={closeMobileMenu}>
            <Building2 size={18} /><span>Statistiques</span>
          </Link>
          <a href="#owner-finances" onClick={closeMobileMenu}>
            <CreditCard size={18} /><span>Paiements</span>
            {properties.filter((property) => property.publication_payment_status === "pending").length > 0 && (
              <span className="owner-nav-badge">
                {properties.filter((property) => property.publication_payment_status === "pending").length}
              </span>
            )}
          </a>
          <a href="#dashboard-notifications" onClick={closeMobileMenu}>
            <Bell size={18} /><span>Notifications</span>
            {unreadNotifications > 0 && <span className="owner-nav-badge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
          </a>
          <a href="#owner-account" onClick={closeMobileMenu}>
            <Settings size={18} /><span>Paramètres</span>
          </a>
        </nav>

        <div className="owner-sidebar-promo">
          <img
            src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=600&q=80"
            alt=""
            loading="lazy"
          />
          <div className="owner-sidebar-promo__overlay" />
          <div className="owner-sidebar-promo__copy">
            <span>IMOVA · ENSEMBLE</span>
            <strong>Construisons ensemble<br />un meilleur cadre de vie !</strong>
            <Link to="/biens" onClick={closeMobileMenu}>Découvrir les biens <ArrowRight size={14} /></Link>
          </div>
        </div>

        <div className="owner-sidebar-account" id="owner-account">
          <div className="owner-avatar owner-avatar--sidebar">{getInitials(name)}</div>
          <div className="owner-sidebar-account__copy">
            <strong>{name}</strong>
            <span>Propriétaire</span>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Déconnexion" title="Déconnexion">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <div className="owner-dashboard-main">
        <header className="owner-topbar">
          <div className="owner-topbar__left">
            <button
              type="button"
              className="owner-menu-toggle"
              aria-label="Ouvrir le menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <form className="owner-search" onSubmit={handleSearch} role="search">
              <Search size={19} aria-hidden="true" />
              <input
                type="search"
                placeholder="Rechercher un bien, une ville..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Rechercher un bien ou une ville"
              />
              <kbd>↵</kbd>
            </form>
          </div>
          <div className="owner-topbar__actions">
            <div className="owner-notification-wrap" id="dashboard-notifications">
              <NotificationCenter onUnreadCountChange={setUnreadNotifications} />
            </div>
            <Link
              to="/messages"
              className="owner-topbar-message"
              aria-label={`Messages, ${unreadMessages} non lus`}
              title="Messages"
            >
              <MessageCircle size={18} />
              {unreadMessages > 0 && (
                <span>{unreadMessages > 99 ? "99+" : unreadMessages}</span>
              )}
            </Link>
            <div className="owner-topbar-user">
              <div className="owner-avatar">
                {user?.avatar_url || user?.photo_url ? (
                  <img src={user.avatar_url || user.photo_url} alt="" />
                ) : getInitials(name)}
              </div>
              <div className="owner-topbar-user__copy">
                <strong>{name}</strong>
                <span>Propriétaire</span>
              </div>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
        </header>

        <main className="owner-dashboard-content">
          {error && <p className="owner-inline-error" role="alert">{error}</p>}
          <section className="owner-welcome-banner">
            <div className="owner-welcome-banner__content">
              <span className="owner-welcome-kicker">VOTRE ESPACE IMOVA</span>
              <h1>Bonjour, {firstName} <span aria-hidden="true">👋</span></h1>
              <p>Gérez vos biens et développez votre activité immobilière.</p>
              <div className="owner-welcome-actions">
                <Link to="/ajouter-bien" className="owner-welcome-button owner-welcome-button--primary">
                  <Plus size={16} /> Ajouter un bien
                </Link>
                <Link to="/activity-stats" className="owner-welcome-button owner-welcome-button--secondary">
                  Voir mes statistiques <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className="owner-welcome-banner__caption">
              <span>IMOVA</span>
              <span>Des lieux de vie, des projets d’avenir.</span>
            </div>
          </section>

          <section className="owner-stats-grid" aria-label="Statistiques immobilières">
            {statCards.map((card, index) => (
              <StatCard key={card.title} {...card} index={index} />
            ))}
          </section>

          <section className="owner-overview-grid">
            <article className="owner-panel owner-revenue-panel">
              <div className="owner-panel-heading">
                <div>
                  <span className="owner-section-kicker">PERFORMANCE</span>
                  <h2>Performance de mes biens</h2>
                  <p>Vues, demandes et visites issues des données disponibles</p>
                </div>
                <button className="owner-period-select" type="button" disabled>
                  <CalendarDays size={15} /> Ce mois <ChevronDown size={14} />
                </button>
              </div>
              <div className="owner-revenue-chart">
                {sectionErrors.activity || sectionErrors.views ? (
                  <div className="owner-chart-empty" role="alert">
                    <span><CircleHelp size={18} /></span>
                    <strong>Performances indisponibles</strong>
                    <p>{sectionErrors.activity || sectionErrors.views}</p>
                  </div>
                ) : performanceData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ownerViewsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563EB" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ownerVisitsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#E9EEF5" strokeDasharray="4 5" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#8793A5", fontSize: 10 }} dy={12} tickFormatter={(value) => value.length > 14 ? `${value.slice(0, 14)}…` : value} />
                      <Tooltip formatter={(value, name) => [Number(value).toLocaleString("fr-FR"), name]} />
                      <Area type="monotone" dataKey="vues" name="Vues" stroke="#2563EB" strokeWidth={2.5} fill="url(#ownerViewsGradient)" />
                      <Area type="monotone" dataKey="visites" name="Visites" stroke="#14B8A6" strokeWidth={2} fill="url(#ownerVisitsGradient)" />
                      <Area type="monotone" dataKey="demandes" name="Demandes" stroke="#F59E0B" strokeWidth={2} fill="transparent" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="owner-chart-empty">
                    <span><Eye size={18} /></span>
                    <strong>Aucune donnée disponible</strong>
                    <p>Les statistiques apparaîtront lorsque vos biens recevront des vues ou des demandes.</p>
                  </div>
                )}
              </div>
              <div className="owner-chart-footnote">
                <span><i className="owner-chart-dot--views" /> Vues</span>
                <span><i className="owner-chart-dot--visits" /> Visites</span>
                <span><i className="owner-chart-dot--contacts" /> Demandes</span>
                <Link to="/activity-stats">Voir le détail <ArrowRight size={13} /></Link>
              </div>
            </article>

            <article className="owner-panel owner-properties-panel" id="owner-properties">
              <div className="owner-panel-heading owner-panel-heading--compact">
                <div>
                  <span className="owner-section-kicker">VOTRE PORTEFEUILLE</span>
                  <h2>Mes biens</h2>
                </div>
                <Link to="/ajouter-bien" className="owner-panel-link"><Plus size={15} /> Ajouter un bien</Link>
              </div>
              {sectionErrors.properties ? (
                <p className="owner-panel-message" role="alert">{sectionErrors.properties}</p>
              ) : recentProperties.length ? (
                <div className="owner-recent-properties">
                  {recentProperties.map((property) => (
                    <PropertyPreview
                      key={property.id}
                      property={property}
                      views={Number(propertyViews.find((item) => String(item.id) === String(property.id))?.total_views) || 0}
                      activity={(activity?.annonces || []).find((item) => String(item.id) === String(property.id))}
                    />
                  ))}
                </div>
              ) : (
                <div className="owner-empty-state">
                  <span><Building2 size={20} /></span>
                  <strong>Votre premier bien vous attend</strong>
                  <p>Publiez une annonce pour la retrouver ici.</p>
                  <Link to="/ajouter-bien">Ajouter un bien <ArrowRight size={14} /></Link>
                </div>
              )}
              {properties.length > recentProperties.length && (
                <Link to="/my-properties" className="owner-all-properties-link">
                  Voir tous mes biens <ArrowRight size={14} />
                </Link>
              )}
            </article>
          </section>

          <section className="owner-activity-grid">
            <article className="owner-panel owner-activity-panel" id="upcoming-visits">
              <div className="owner-panel-heading owner-panel-heading--compact">
                <div>
                  <span className="owner-section-kicker">À VENIR</span>
                  <h2>Prochaines visites</h2>
                </div>
                <button
                  type="button"
                  className="owner-panel-link owner-panel-link-button"
                  onClick={() => setShowAllVisits((visible) => !visible)}
                >
                  {showAllVisits ? "Réduire" : "Voir toutes"} <ArrowRight size={15} />
                </button>
              </div>
              {sectionErrors.visits ? (
                <p className="owner-panel-message" role="alert">{sectionErrors.visits}</p>
              ) : upcomingVisits.length ? (
                <div className="owner-visit-list">
                  {visibleVisits.map((visit) => {
                    const propertyTitle = visit.property_title || "Bien immobilier";
                    const visitor = visit.client_name || "Visiteur";
                    return (
                      <article className="owner-visit-item" key={visit.id}>
                        <div className="owner-visit-date">
                          <strong>{visit.dashboardDate.getDate()}</strong>
                          <span>{visit.dashboardDate.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span>
                        </div>
                        <img src={visit.image_url || defaultPropertyImage} alt="" loading="lazy" />
                        <div className="owner-visit-copy">
                          <strong>{propertyTitle}</strong>
                          <span>{visitor} <i /> {formatVisitDate(visit.dashboardDate)} · {visit.dashboardDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <span className={`owner-visit-status owner-visit-status--${visit.status || "pending"}`}>
                          <Clock3 size={12} /> {visit.status === "confirmee" || visit.status === "acceptee" || visit.status === "accepted" ? "Confirmée" : "En attente"}
                        </span>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="owner-empty-state owner-empty-state--inline">
                  <span><CalendarDays size={19} /></span>
                  <div><strong>Aucune visite à venir</strong><p>Les prochaines demandes de visite apparaîtront ici.</p></div>
                </div>
              )}
            </article>

            <article className="owner-panel owner-activity-panel">
              <div className="owner-panel-heading owner-panel-heading--compact">
                <div>
                  <span className="owner-section-kicker">ÉCHANGES RÉCENTS</span>
                  <h2>Derniers messages</h2>
                </div>
                <Link to="/messages" className="owner-panel-link">Voir tous <ArrowRight size={15} /></Link>
              </div>
              {sectionErrors.messages ? (
                <p className="owner-panel-message" role="alert">{sectionErrors.messages}</p>
              ) : recentConversations.length ? (
                <div className="owner-message-list">
                  {recentConversations.map((conversation) => {
                    const otherName = conversation.otherUser?.nom
                      || [conversation.first_name, conversation.last_name].filter(Boolean).join(" ")
                      || "Utilisateur";
                    return (
                      <Link
                        to={`/messages/${conversation.id}`}
                        className="owner-message-item"
                        key={conversation.id}
                      >
                        <span className="owner-message-avatar">{getInitials(otherName)}</span>
                        <span className="owner-message-copy">
                          <strong>{otherName}</strong>
                          <span>{conversation.last_message || conversation.lastMessage || "Nouvelle conversation"}</span>
                        </span>
                        <span className="owner-message-meta">
                          <time>
                            {formatMessageTime(conversation.lastMessageDate)}
                          </time>
                          {Number(conversation.unreadCount) > 0 && (
                            <span className="owner-message-unread">{conversation.unreadCount}</span>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="owner-empty-state owner-empty-state--inline">
                  <span><MessageCircle size={19} /></span>
                  <div><strong>Pas encore de conversation</strong><p>Vos échanges avec les visiteurs apparaîtront ici.</p></div>
                </div>
              )}
            </article>
          </section>

          <section className="owner-panel owner-finance-panel" id="owner-finances">
            <div className="owner-panel-heading owner-panel-heading--compact">
              <div>
                <span className="owner-section-kicker">SUIVI DES PUBLICATIONS</span>
                <h2>Activité financière</h2>
                <p>Statut de paiement des publications communiqué par votre compte.</p>
              </div>
              <CreditCard size={20} aria-hidden="true" />
            </div>
            {properties.some((property) => ["paid", "pending"].includes(property.publication_payment_status)) ? (
              <div className="owner-finance-list">
                {properties
                  .filter((property) => ["paid", "pending"].includes(property.publication_payment_status))
                  .slice(0, 4)
                  .map((property) => (
                    <div className="owner-finance-item" key={property.id}>
                      <span className="owner-finance-item__icon"><Building2 size={16} /></span>
                      <span className="owner-finance-item__copy">
                        <strong>{property.title || property.titre || "Bien immobilier"}</strong>
                        <small>Publication de l’annonce</small>
                      </span>
                      <span className={`owner-finance-status${property.publication_payment_status === "paid" ? " is-paid" : " is-pending"}`}>
                        <i /> {property.publication_payment_status === "paid" ? "Confirmé" : "En attente"}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="owner-finance-empty">
                <span><CreditCard size={17} /></span>
                <p>Aucune activité de paiement disponible. L’historique des montants n’est pas exposé par l’API actuelle.</p>
              </div>
            )}
          </section>

          <footer className="owner-dashboard-footer">
            <span>© {currentYear} IMOVA · Votre rêve, notre priorité</span>
            <Link to="/contact">Besoin d’aide ?</Link>
          </footer>
        </main>
      </div>

      <button type="button" className="owner-mobile-logout" onClick={handleLogout} aria-label="Déconnexion">
        <LogOut size={18} />
      </button>
    </div>
  );
}
