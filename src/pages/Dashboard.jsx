import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Building2,
  CalendarDays,
  CreditCard,
  Heart,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import Navbar from "../components/Navbar";
import PropertyCard from "../components/PropertyCard";
import { API_URL } from "../config/api";
import useSEO from "../utils/useSEO";
import "./Dashboard.css";

const EMPTY_STATS = { favorites: null, visits: null, unreadMessages: null };

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

function getVisitDateTime(visit) {
  const date = String(visit.visit_date || "").slice(0, 10);
  const time = String(visit.visit_time || "00:00").slice(0, 5);
  return new Date(`${date}T${time}`);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "C";
}

function SectionHeading({ eyebrow, title, description, to, linkLabel }) {
  return (
    <div className="client-section-heading">
      <div>
        <span className="client-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {to && (
        <Link to={to} className="client-section-link">
          {linkLabel || "Tout voir"} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  useSEO({ title: "Mon espace client IMOVA", noindex: true });

  const navigate = useNavigate();
  const [user, setUser] = useState(readStoredUser);
  const [currentTime] = useState(() => new Date());
  const [currentYear] = useState(() => new Date().getFullYear());
  const [stats, setStats] = useState(EMPTY_STATS);
  const [properties, setProperties] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [visits, setVisits] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState({ city: "", type: "", maxPrice: "", bedrooms: "" });
  const [sectionErrors, setSectionErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const name = user?.nom || user?.name || "Client";
  const firstName = name.trim().split(/\s+/)[0] || "Client";
  const upcomingVisits = useMemo(() => visits
    .map((visit) => ({ ...visit, dashboardDate: getVisitDateTime(visit) }))
    .filter((visit) => (
      visit.dashboardDate >= currentTime &&
      !["annulee", "cancelled", "rejected", "terminee"].includes(
        String(visit.status || "").toLowerCase()
      )
    ))
    .sort((a, b) => a.dashboardDate - b.dashboardDate), [currentTime, visits]);
  const unreadCount = conversations.reduce(
    (total, conversation) => total + (Number(conversation.unreadCount) || 0),
    0
  );
  const recommendationProperties = properties.slice(0, 3);
  const discoveryProperties = properties.slice(3, 6);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Connectez-vous pour accéder à votre espace personnel.");
        setLoading(false);
        return;
      }

      const results = await Promise.allSettled([
        fetchJson("/auth/me", token),
        fetchJson("/dashboard/stats", token),
        fetchJson("/properties", token),
        fetchJson("/favorites", token),
        fetchJson("/visits/my-visits", token),
        fetchJson("/messages/conversations", token),
      ]);
      if (!active) return;

      const [profileResult, statsResult, propertiesResult, favoritesResult, visitsResult, conversationsResult] = results;
      if (profileResult.status === "fulfilled") {
        const profile = profileResult.value.user ?? profileResult.value;
        setUser(profile);
      } else {
        setError(profileResult.reason.message || "Impossible de charger votre profil.");
      }

      if (statsResult.status === "fulfilled") {
        setStats({ ...EMPTY_STATS, ...statsResult.value });
      } else {
        setSectionErrors((previous) => ({ ...previous, stats: statsResult.reason.message }));
      }

      const errors = {};
      if (propertiesResult.status === "fulfilled") {
        setProperties(Array.isArray(propertiesResult.value) ? propertiesResult.value : []);
      } else {
        errors.properties = propertiesResult.reason.message;
      }
      if (favoritesResult.status === "fulfilled") {
        setFavorites(Array.isArray(favoritesResult.value) ? favoritesResult.value : []);
      } else {
        errors.favorites = favoritesResult.reason.message;
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
      setSectionErrors((previous) => ({ ...previous, ...errors }));
      setLoading(false);
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  function handleSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(search).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    navigate(`/advanced-search${params.size ? `?${params.toString()}` : ""}`);
  }

  if (loading) {
    return <div className="client-dashboard-state">Préparation de votre espace IMOVA…</div>;
  }

  if (error && !user) {
    return (
      <div className="client-dashboard-state">
        <p>{error}</p>
        <Link to="/connexion" className="client-primary-button">Se connecter</Link>
      </div>
    );
  }

  const statsCards = [
    { title: "Favoris", value: Number(stats.favorites ?? favorites.length), icon: Heart, to: "/favoris", tone: "rose", note: "Biens sauvegardés" },
    { title: "Mes visites", value: Number(stats.visits ?? visits.length), icon: CalendarDays, to: "/mes-visites", tone: "blue", note: "Demandes enregistrées" },
    { title: "Conversations", value: conversations.length, icon: MessageCircle, to: "/messages", tone: "teal", note: `${unreadCount} non lue${unreadCount === 1 ? "" : "s"}` },
    { title: "Paiements", value: "—", icon: CreditCard, tone: "gold", note: "Historique non disponible" },
  ];

  return (
    <div className="client-workspace">
      <Navbar />
      <main className="client-dashboard">
        {error && <p className="client-inline-error" role="alert">{error}</p>}

        <div className="client-dashboard-toolbar">
          <form className="client-header-search" role="search" onSubmit={handleSearch}>
            <Search size={18} />
            <input
              aria-label="Rechercher une ville, un quartier ou un bien"
              placeholder="Rechercher une ville, un quartier ou un bien..."
              value={search.city}
              onChange={(event) => setSearch((previous) => ({ ...previous, city: event.target.value }))}
            />
            <button type="submit" aria-label="Lancer la recherche"><ArrowRight size={17} /></button>
          </form>
          <Link className="client-toolbar-favorites" to="/favoris"><Heart size={17} /> Favoris</Link>
          <Link className="client-toolbar-user" to="/profile">
            <span className="client-user-avatar">
              {user?.avatar_url || user?.photo_url
                ? <img src={user.avatar_url || user.photo_url} alt="" />
                : getInitials(name)}
            </span>
            <span>{name}</span>
          </Link>
        </div>

        <section className="client-hero">
          <div className="client-hero-copy">
            <span className="client-hero-kicker"><Sparkles size={14} /> VOTRE PROCHAIN CHAPITRE COMMENCE ICI</span>
            <h1>Bonjour, {firstName} <span aria-hidden="true">👋</span><br />Trouvez le bien qui vous ressemble.</h1>
            <p>Explorez les meilleures opportunités immobilières sur IMOVA.</p>
          </div>
          <form className="client-hero-search" onSubmit={handleSearch}>
            <label className="client-search-field client-search-location">
              <span><MapPin size={16} /> Localisation</span>
              <input
                placeholder="Où souhaitez-vous habiter ?"
                value={search.city}
                onChange={(event) => setSearch((previous) => ({ ...previous, city: event.target.value }))}
              />
            </label>
            <label className="client-search-field">
              <span><Building2 size={16} /> Type de bien</span>
              <select value={search.type} onChange={(event) => setSearch((previous) => ({ ...previous, type: event.target.value }))}>
                <option value="">Tous les types</option>
                <option value="maison">Maison</option>
                <option value="appartement">Appartement</option>
                <option value="terrain">Terrain</option>
              </select>
            </label>
            <label className="client-search-field">
              <span><CreditCard size={16} /> Budget maximum</span>
              <input
                type="number"
                min="0"
                placeholder="FCFA"
                value={search.maxPrice}
                onChange={(event) => setSearch((previous) => ({ ...previous, maxPrice: event.target.value }))}
              />
            </label>
            <label className="client-search-field client-search-bedrooms">
              <span><BedDouble size={16} /> Chambres min.</span>
              <select value={search.bedrooms} onChange={(event) => setSearch((previous) => ({ ...previous, bedrooms: event.target.value }))}>
                <option value="">Indifférent</option>
                {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}+</option>)}
              </select>
            </label>
            <button className="client-search-submit" type="submit"><Search size={17} /> Rechercher</button>
          </form>
          <div className="client-hero-decoration" aria-hidden="true"><span /><i /></div>
        </section>

        <section className="client-stats-grid" aria-label="Votre activité">
          {statsCards.map(({ title, value, icon: Icon, to, tone, note }) => (
            <article className={`client-stat-card client-stat-card--${tone}`} key={title}>
              <span className="client-stat-icon"><Icon size={19} /></span>
              <div className="client-stat-copy">
                <span>{title}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </div>
              {to && <Link to={to} aria-label={`Voir ${title}`}><ArrowUpRight size={17} /></Link>}
            </article>
          ))}
        </section>

        <section className="client-properties-section">
          <SectionHeading
            eyebrow="SÉLECTION IMOVA"
            title="Biens recommandés pour vous"
            description="Les dernières annonces disponibles sur IMOVA."
            to="/biens"
            linkLabel="Explorer tous les biens"
          />
          {sectionErrors.properties ? (
            <p className="client-section-error" role="alert">{sectionErrors.properties}</p>
          ) : recommendationProperties.length ? (
            <div className="client-property-grid">
              {recommendationProperties.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          ) : (
            <div className="client-empty-state"><Building2 size={22} /><strong>Aucun bien disponible pour le moment</strong><p>De nouvelles annonces apparaîtront ici.</p></div>
          )}
        </section>

        <section className="client-properties-section">
          <SectionHeading
            eyebrow="À DÉCOUVRIR"
            title="Les biens à découvrir"
            description="L’API actuelle ne fournit pas encore de classement par popularité."
            to="/biens"
            linkLabel="Voir les annonces"
          />
          {sectionErrors.properties ? (
            <p className="client-section-error" role="alert">{sectionErrors.properties}</p>
          ) : discoveryProperties.length ? (
            <div className="client-property-grid">
              {discoveryProperties.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          ) : (
            <div className="client-empty-state client-empty-state--compact"><Sparkles size={20} /><strong>Aucune autre annonce à afficher</strong><p>Explorez les biens disponibles pour trouver votre coup de cœur.</p></div>
          )}
        </section>

        <section className="client-lower-grid">
          <article className="client-panel">
            <SectionHeading eyebrow="VOTRE SÉLECTION" title="Mes favoris" to="/favoris" linkLabel="Voir tous mes favoris" />
            {sectionErrors.favorites ? (
              <p className="client-section-error" role="alert">{sectionErrors.favorites}</p>
            ) : favorites.length ? (
              <div className="client-mini-properties">
                {favorites.slice(0, 3).map((property) => (
                  <Link className="client-mini-property" to={`/bien/${property.id}`} key={property.id}>
                    <img src={property.image_url || property.image} alt="" loading="lazy" />
                    <span><strong>{property.title || property.titre || "Bien immobilier"}</strong><small>{property.city || property.ville || "Bénin"}</small></span>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="client-empty-state client-empty-state--inline"><Heart size={19} /><div><strong>Vos coups de cœur vous attendent</strong><p>Ajoutez un bien aux favoris pour le retrouver ici.</p><Link to="/biens">Explorer les biens <ArrowRight size={14} /></Link></div></div>
            )}
          </article>

          <article className="client-panel">
            <SectionHeading eyebrow="VOTRE AGENDA" title="Mes prochaines visites" to="/mes-visites" linkLabel="Voir mes visites" />
            {sectionErrors.visits ? (
              <p className="client-section-error" role="alert">{sectionErrors.visits}</p>
            ) : upcomingVisits.length ? (
              <div className="client-visit-list">
                {upcomingVisits.slice(0, 3).map((visit) => (
                  <div className="client-visit-item" key={visit.id}>
                    <img src={visit.image_url || ""} alt="" loading="lazy" />
                    <span className="client-visit-copy"><strong>{visit.property_title || "Bien immobilier"}</strong><small>{visit.city || visit.district || "Bénin"}</small></span>
                    <span className={`client-visit-status${["acceptee", "confirmee", "accepted"].includes(String(visit.status).toLowerCase()) ? " is-confirmed" : ""}`}>
                      {["acceptee", "confirmee", "accepted"].includes(String(visit.status).toLowerCase()) ? "Confirmée" : "En attente"}
                    </span>
                    <time>{formatTime(visit.dashboardDate)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="client-empty-state client-empty-state--inline"><CalendarDays size={19} /><div><strong>Aucune visite à venir</strong><p>Vos prochaines visites apparaîtront dans cet espace.</p><Link to="/biens">Trouver un bien <ArrowRight size={14} /></Link></div></div>
            )}
          </article>

          <article className="client-panel client-conversations-panel">
            <SectionHeading eyebrow="ÉCHANGES RÉCENTS" title="Mes conversations" to="/messages" linkLabel="Voir mes messages" />
            {sectionErrors.messages ? (
              <p className="client-section-error" role="alert">{sectionErrors.messages}</p>
            ) : conversations.length ? (
              <div className="client-conversation-list">
                {conversations.slice(0, 4).map((conversation) => {
                  const otherName = conversation.otherUser?.nom || conversation.otherUser?.name || "Propriétaire";
                  return (
                    <Link to={`/messages/${conversation.id}`} className="client-conversation-item" key={conversation.id}>
                      <span className="client-conversation-avatar">{getInitials(otherName)}</span>
                      <span className="client-conversation-copy"><strong>{otherName}</strong><small>{conversation.propertyTitle || "Bien immobilier"} · {conversation.last_message || conversation.lastMessage || "Nouvelle conversation"}</small></span>
                      <span className="client-conversation-meta"><time>{formatTime(conversation.lastMessageDate)}</time>{Number(conversation.unreadCount) > 0 && <i>{conversation.unreadCount}</i>}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="client-empty-state client-empty-state--inline"><MessageCircle size={19} /><div><strong>Vos échanges prendront place ici</strong><p>Contactez un propriétaire depuis une annonce.</p><Link to="/biens">Explorer les annonces <ArrowRight size={14} /></Link></div></div>
            )}
          </article>

          <article className="client-panel client-account-panel">
            <SectionHeading eyebrow="VOTRE COMPTE" title="Vos accès rapides" />
            <div className="client-quick-links">
              <Link to="/carte"><MapPin size={17} /> Explorer la carte <ArrowRight size={15} /></Link>
              <Link to="/notifications"><Building2 size={17} /> Mes notifications <ArrowRight size={15} /></Link>
              <Link to="/profile"><UserRound size={17} /> Mon profil <ArrowRight size={15} /></Link>
              <Link to="/change-password"><CreditCard size={17} /> Sécurité du compte <ArrowRight size={15} /></Link>
            </div>
            {sectionErrors.stats && <p className="client-section-error" role="alert">{sectionErrors.stats}</p>}
          </article>
        </section>
        <footer className="client-dashboard-footer">© {currentYear} IMOVA · L’immobilier autrement.</footer>
      </main>
    </div>
  );
}
