import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleX,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import NotificationCenter from "../components/NotificationCenter";
import useSEO from "../utils/useSEO";
import { API_URL } from "../config/api";
import BrandLogo from "../components/BrandLogo";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  useSEO({
    title: "Administration — IMOVA",
    noindex: true,
  });

  const [adminUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const [now] = useState(() => new Date());
  const [currentYear] = useState(() => new Date().getFullYear());
  const [stats, setStats] = useState({
    users: 0,
    properties: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [pendingProperties, setPendingProperties] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState([]);
  const [availableProperties, setAvailableProperties] = useState([]);
  const [reports, setReports] = useState([]);
  const [visits, setVisits] = useState([]);
  const [users, setUsers] = useState([]);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [updatingVerificationId, setUpdatingVerificationId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("token");

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/admin/stats", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/admin/reports", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (response.ok) {
        setReports(data);
      }
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const fetchPendingProperties = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/admin/properties/pending", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setPendingProperties(data);
      }
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const fetchAllProperties = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/admin/properties", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de charger les annonces.");
      setAllProperties(data);
    } catch (error) {
      console.error("Erreur chargement portefeuille admin :", error);
    }
  }, [token]);

  const fetchMonthlyAnalytics = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/admin/analytics/monthly", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de charger les analyses.");
      setMonthlyAnalytics(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement analyses admin :", error);
    }
  }, [token]);

  const fetchAvailableProperties = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/admin/properties?status=disponible", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de charger les annonces.");
      setAvailableProperties(data);
    } catch (error) {
      console.error("Erreur chargement annonces disponibles :", error);
      alert(error.message || "Impossible de charger les annonces disponibles.");
    }
  }, [token]);

  const fetchVisits = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/visits/admin/all", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (response.ok) {
        setVisits(data);
      }
    } catch (error) {
      console.error("Erreur chargement visites admin :", error);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(API_URL + "/admin/users", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      } else {
        alert(data.message || "Impossible de charger les comptes utilisateurs.");
      }
    } catch (error) {
      console.error("Erreur chargement comptes utilisateurs :", error);
      alert("Impossible de joindre le serveur pour charger les comptes.");
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      fetchStats();
      fetchPendingProperties();
      fetchAvailableProperties();
      fetchAllProperties();
      fetchMonthlyAnalytics();
      fetchReports();
      fetchVisits();
      fetchUsers();
    });
    return () => {
      active = false;
    };
  }, [fetchAllProperties, fetchAvailableProperties, fetchMonthlyAnalytics, fetchPendingProperties, fetchReports, fetchStats, fetchUsers, fetchVisits]);

  const rentedOrSoldCount = useMemo(
    () => allProperties.filter((property) => ["loue", "vendu"].includes(String(property.status || "").toLowerCase())).length,
    [allProperties]
  );
  const recentProperties = useMemo(() => allProperties.slice(0, 3), [allProperties]);
  const propertiesById = useMemo(
    () => new Map(allProperties.map((property) => [String(property.id), property])),
    [allProperties]
  );
  const upcomingVisits = useMemo(() => {
    return visits
      .map((visit) => {
        const dateText = String(visit.visit_date || "").slice(0, 10);
        const timeText = String(visit.visit_time || "00:00").slice(0, 5);
        return { ...visit, dashboardDate: new Date(`${dateText}T${timeText}`) };
      })
      .filter((visit) => (
        !Number.isNaN(visit.dashboardDate.getTime())
        && visit.dashboardDate >= now
        && !["annulee", "cancelled", "rejected", "terminee"].includes(String(visit.status || "").toLowerCase())
      ))
      .sort((a, b) => a.dashboardDate - b.dashboardDate);
  }, [now, visits]);
  const searchTerm = search.trim().toLocaleLowerCase("fr");
  const filterRows = (rows, getSearchableText) => (
    searchTerm ? rows.filter((row) => getSearchableText(row).toLocaleLowerCase("fr").includes(searchTerm)) : rows
  );
  const filteredUsers = filterRows(users, (user) => `${user.nom || ""} ${user.email || ""} ${user.role || ""}`);
  const filteredPendingProperties = filterRows(pendingProperties, (property) => `${property.titre || ""} ${property.ville || ""}`);
  const filteredReports = filterRows(reports, (report) => `${report.property_title || ""} ${report.reason || ""} ${report.reporter_name || ""}`);
  const filteredVisits = filterRows(visits, (visit) => `${visit.property_title || ""} ${visit.client_name || ""} ${visit.owner_name || ""}`);
  const filteredRecentProperties = filterRows(recentProperties, (property) => `${property.titre || ""} ${property.ville || ""} ${property.proprietaire_nom || ""}`);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  const updateVerification = async (kind, item) => {
    const isUser = kind === "users";
    const nextValue = !item.is_verified;
    const targetId = item.id;
    setUpdatingVerificationId(`${kind}-${targetId}`);
    try {
      const response = await fetch(`${API_URL}/admin/${kind}/${targetId}/verification`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ is_verified: nextValue }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de modifier la vérification.");
      if (isUser) {
        setUsers((current) => current.map((user) => user.id === item.id ? data.user : user));
      } else {
        setAvailableProperties((current) => current.map((property) => property.id === item.id ? data.property : property));
      }
    } catch (error) {
      console.error("Erreur modification vérification :", error);
      alert(error.message || "Impossible de modifier le statut de vérification.");
    } finally {
      setUpdatingVerificationId(null);
    }
  };

  const updateUserStatus = async (user) => {
    const nextStatus = !user.is_active;
    const action = nextStatus ? "réactiver" : "suspendre";
    if (!window.confirm(`Confirmer la demande pour ${action} le compte de ${user.nom || user.email} ?`)) {
      return;
    }

    setUpdatingUserId(user.id);
    try {
      const response = await fetch(API_URL + "/admin/users/" + user.id + "/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ is_active: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "Impossible de modifier le statut du compte.");
        return;
      }
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id ? data.user : currentUser
        )
      );
    } catch (error) {
      console.error("Erreur modification statut compte :", error);
      alert("Impossible de joindre le serveur pour modifier ce compte.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateVisitStatus = async (id, status) => {
    try {
      const response = await fetch(API_URL + "/visits/" + id + "/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        fetchVisits();
      } else {
        const err = await response.json();
        alert(err.message || "Erreur de mise à jour");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const approveProperty = async (id) => {
    try {
      const response = await fetch(API_URL + "/admin/properties/" + id + "/approve", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      if (response.ok) {
        fetchStats();
        fetchPendingProperties();
        fetchAvailableProperties();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const rejectProperty = async (id) => {
    const reason = prompt("Pourquoi rejeter ce bien ?");

    if (!reason) return;

    try {
      const response = await fetch(API_URL + "/admin/properties/" + id + "/reject", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        fetchStats();
        fetchPendingProperties();
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="admin-workspace">
      {mobileMenuOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Fermer le menu"
          onClick={closeMobileMenu}
        />
      )}
      <aside className={`admin-sidebar${mobileMenuOpen ? " is-open" : ""}`}>
        <Link to="/admin" className="admin-brand" onClick={closeMobileMenu}>
          <span className="admin-brand-mark"><BrandLogo variant="symbol" /></span>
          <span className="admin-brand-wordmark"><BrandLogo variant="white" /></span>
        </Link>
        <button type="button" className="admin-sidebar-close" aria-label="Fermer le menu" onClick={closeMobileMenu}>
          <X size={20} />
        </button>
        <p className="admin-sidebar-label">PILOTAGE</p>
        <nav className="admin-sidebar-nav" aria-label="Navigation administrateur">
          <a href="#admin-stats" className="is-active" onClick={closeMobileMenu}><LayoutDashboard size={18} /><span>Tableau de bord</span></a>
          <a href="#admin-pending" onClick={closeMobileMenu}><Building2 size={18} /><span>Annonces à valider</span><b>{pendingProperties.length}</b></a>
          <a href="#admin-reports" onClick={closeMobileMenu}><CircleX size={18} /><span>Signalements</span><b>{reports.length}</b></a>
          <a href="#admin-visits" onClick={closeMobileMenu}><CalendarDays size={18} /><span>Visites</span><b>{visits.length}</b></a>
          <a href="#admin-users" onClick={closeMobileMenu}><UsersRound size={18} /><span>Comptes</span></a>
          <Link to="/admin/payments" onClick={closeMobileMenu}><CreditCard size={18} /><span>Gestion des paiements</span></Link>
          <Link to="/admin/messages" onClick={closeMobileMenu}><MessageCircle size={18} /><span>Messages signalés</span></Link>
          <Link to="/admin/settings" onClick={closeMobileMenu}><Settings size={18} /><span>Paramètres</span></Link>
        </nav>
        <div className="admin-sidebar-note">
          <span><ShieldCheck size={16} /></span>
          <strong>Espace sécurisé</strong>
          <p>Console de gestion de la plateforme IMOVA.</p>
        </div>
        <div className="admin-sidebar-account">
          <span className="admin-avatar">{(adminUser?.nom || "Administrateur").trim().charAt(0).toUpperCase()}</span>
          <span className="admin-sidebar-account-copy"><strong>{adminUser?.nom || "Administrateur"}</strong><small>Super Admin</small></span>
          <button type="button" onClick={handleLogout} aria-label="Déconnexion" title="Déconnexion"><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-start">
            <button
              type="button"
              className="admin-menu-toggle"
              aria-label="Ouvrir le menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <form className="admin-search" role="search" onSubmit={(event) => event.preventDefault()}>
              <Search size={18} />
              <input
                type="search"
                placeholder="Rechercher un bien, un utilisateur..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Rechercher dans les comptes, biens, visites et signalements"
              />
              <kbd>/</kbd>
            </form>
          </div>
          <div className="admin-topbar-actions">
            <div className="admin-notification-wrap">
              <NotificationCenter />
            </div>
            <div className="admin-topbar-profile">
              <span className="admin-avatar">{(adminUser?.nom || "Administrateur").trim().charAt(0).toUpperCase()}</span>
              <span><strong>Administrateur</strong><small><i /> Super Admin · En ligne</small></span>
              <ChevronDown size={16} />
            </div>
          </div>
        </header>

        <main className="admin-dashboard">
          <section className="admin-hero">
            <div className="admin-hero-content">
              <span className="admin-hero-badge"><ShieldCheck size={14} /> Espace Administrateur</span>
              <h1>Bonjour, Administrateur <span aria-hidden="true">👋</span></h1>
              <p>Voici un aperçu global de votre plateforme IMOVA</p>
              <a href="#admin-analytics" className="admin-hero-button">Voir les statistiques <ChartNoAxesCombined size={16} /></a>
            </div>
            <div className="admin-hero-caption"><span>IMOVA</span><span>Un regard clair sur votre activité immobilière.</span></div>
          </section>

          <section className="stats-grid" id="admin-stats" aria-label="Indicateurs clés">
            <article className="stat-card stat-users">
              <div className="stat-card-top"><span className="stat-icon"><UsersRound size={20} /></span><span className="stat-label-chip">Plateforme</span></div>
              <p>{stats.users.toLocaleString("fr-FR")}</p><h3>Utilisateurs</h3>
              <svg viewBox="0 0 90 32" aria-hidden="true"><path d="M2 26 C13 23 19 25 27 16 S42 12 50 18 S66 11 75 9 S83 5 88 3" /></svg>
            </article>
            <article className="stat-card stat-properties">
              <div className="stat-card-top"><span className="stat-icon"><Building2 size={20} /></span><span className="stat-label-chip">Portefeuille</span></div>
              <p>{stats.properties.toLocaleString("fr-FR")}</p><h3>Total des biens</h3>
              <svg viewBox="0 0 90 32" aria-hidden="true"><path d="M2 25 C13 25 16 17 26 19 S41 8 51 15 S64 19 71 8 S82 7 88 3" /></svg>
            </article>
            <article className="stat-card stat-transactions">
              <div className="stat-card-top"><span className="stat-icon"><BadgeCheck size={20} /></span><span className="stat-label-chip">Transactions</span></div>
              <p>{rentedOrSoldCount.toLocaleString("fr-FR")}</p><h3>Biens loués / vendus</h3>
              <svg viewBox="0 0 90 32" aria-hidden="true"><path d="M2 27 C13 21 17 23 27 16 S42 21 49 13 S61 15 71 8 S81 9 88 3" /></svg>
            </article>
            <article className="stat-card stat-revenue">
              <div className="stat-card-top"><span className="stat-icon"><CreditCard size={20} /></span><span className="stat-label-chip">Finances</span></div>
              <p className="stat-unavailable">—</p><h3>Revenus ce mois</h3>
              <span className="stat-data-note">Donnée non fournie par l’API</span>
            </article>
          </section>

          <section className="admin-analytics-grid" id="admin-analytics">
            <article className="admin-panel admin-chart-panel">
              <div className="admin-panel-heading">
                <div><span className="admin-section-kicker">CROISSANCE DE LA PLATEFORME</span><h2>Évolution de l’activité</h2><p>Inscriptions et annonces publiées · 6 derniers mois</p></div>
                <span className="admin-period-pill"><CalendarDays size={14} /> Ce mois <ChevronDown size={13} /></span>
              </div>
              <div className="admin-chart">
                {monthlyAnalytics.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyAnalytics} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminUsersGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.2} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient>
                        <linearGradient id="adminPropertiesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F59E0B" stopOpacity={0.17} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#EDF1F6" strokeDasharray="4 5" />
                      <XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{ fill: "#8995A8", fontSize: 10 }} dy={9} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8995A8", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ border: "1px solid #E8EDF4", borderRadius: 12, boxShadow: "0 10px 24px rgba(7,21,47,.1)", fontSize: 11 }} />
                      <Area type="monotone" dataKey="utilisateurs" name="Utilisateurs" stroke="#2563EB" strokeWidth={2.5} fill="url(#adminUsersGradient)" />
                      <Area type="monotone" dataKey="biens" name="Biens" stroke="#F59E0B" strokeWidth={2.5} fill="url(#adminPropertiesGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="admin-chart-empty"><ChartNoAxesCombined size={21} /><strong>Analyse indisponible</strong><span>Les données mensuelles n’ont pas pu être chargées.</span></div>}
              </div>
              <div className="admin-chart-legend"><span><i className="legend-users" /> Utilisateurs</span><span><i className="legend-properties" /> Biens publiés</span><small>Les revenus ne sont pas exposés par les API actuelles.</small></div>
            </article>

            <article className="admin-panel admin-recent-panel">
              <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">DERNIÈRES PUBLICATIONS</span><h2>Annonces récentes</h2></div><a href="#admin-verification" className="admin-panel-link">Voir toutes <ArrowRight size={14} /></a></div>
              {recentProperties.length ? (
                <div className="admin-recent-list">
                  {filteredRecentProperties.map((property) => {
                    const status = String(property.status || "").toLowerCase();
                    const statusLabel = status === "vendu" ? "Vendu" : status === "loue" ? "Loué" : status === "en_attente" ? "En attente" : status === "rejete" ? "Rejeté" : "Disponible";
                    return (
                      <article className="admin-recent-property" key={property.id}>
                        <Link to={`/bien/${property.id}`} className="admin-recent-image"><img src={property.image_url || "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=480&q=80"} alt={property.titre || "Bien immobilier"} loading="lazy" /></Link>
                        <div className="admin-recent-copy"><div><span className={`admin-property-status status-${status}`}>{statusLabel}</span><h3>{property.titre || "Bien immobilier"}</h3><p><Home size={12} /> {property.ville || "Ville non renseignée"}{property.proprietaire_nom ? ` · ${property.proprietaire_nom}` : ""}</p><strong>{Number(property.prix) > 0 ? `${Number(property.prix).toLocaleString("fr-FR")} FCFA` : "Prix sur demande"}</strong></div><Link to={`/bien/${property.id}`} className="admin-property-view" aria-label={`Voir ${property.titre || "le bien"}`}><ArrowUpRight size={16} /></Link></div>
                      </article>
                    );
                  })}
                </div>
              ) : <p className="admin-empty">Aucune annonce récente à afficher.</p>}
            </article>
          </section>

          <section className="admin-lower-grid">
            <article className="admin-panel admin-upcoming-panel">
              <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">AGENDA</span><h2>Prochaines visites</h2></div><a href="#admin-visits" className="admin-panel-link">Voir toutes <ArrowRight size={14} /></a></div>
              {upcomingVisits.length ? (
                <div className="admin-upcoming-list">
                  {upcomingVisits.slice(0, 3).map((visit) => (
                    <div className="admin-upcoming-item" key={visit.id}>
                      <div className="admin-upcoming-date"><strong>{visit.dashboardDate.getDate()}</strong><span>{visit.dashboardDate.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span></div>
                      <span className="admin-upcoming-icon">{propertiesById.get(String(visit.property_id))?.image_url ? <img src={propertiesById.get(String(visit.property_id)).image_url} alt="" /> : <Home size={16} />}</span>
                      <div className="admin-upcoming-copy"><strong>{visit.property_title || "Bien immobilier"}</strong><span>{visit.client_name || "Visiteur"} · {visit.dashboardDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
                      <span className={`admin-upcoming-status ${["confirmee", "acceptee", "accepted"].includes(String(visit.status).toLowerCase()) ? "is-confirmed" : ""}`}><i />{["confirmee", "acceptee", "accepted"].includes(String(visit.status).toLowerCase()) ? "Confirmée" : "En attente"}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="admin-empty-inline"><CalendarDays size={19} /><span><strong>Aucune visite à venir</strong><small>Les prochaines demandes apparaîtront ici.</small></span></div>}
            </article>
            <article className="admin-panel admin-messages-panel">
              <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">MESSAGERIE</span><h2>Modération des messages</h2></div><Link to="/admin/messages" className="admin-panel-link">Voir les signalements <ArrowRight size={14} /></Link></div>
              <div className="admin-empty-inline"><MessageCircle size={19} /><span><strong>Examen des messages signalés</strong><small>La console n’affiche que les conversations signalées par un participant, sans accès global aux échanges privés.</small></span></div>
            </article>
          </section>

          <section className="admin-panel users-section" id="admin-users" aria-labelledby="users-section-title">
            <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">ACCÈS & PROFILS</span><h2 id="users-section-title"><UsersRound size={18} /> Gestion des comptes</h2></div><span className="admin-section-count">{filteredUsers.length} compte{filteredUsers.length === 1 ? "" : "s"}</span></div>
            {filteredUsers.length === 0 ? <p className="admin-empty">Aucun compte correspondant à votre recherche.</p> : (
              <div className="users-list">
                {filteredUsers.map((user) => (
                  <article className="admin-user" key={user.id}>
                    <div className="admin-user-details"><span className="admin-user-avatar">{(user.nom || user.email || "?").trim().charAt(0).toUpperCase()}</span><div><h3>{user.nom || "Utilisateur"}</h3><p>{user.email}</p><span className="admin-user-role">{user.role}</span></div></div>
                    <div className="admin-user-actions">
                      {user.role === "proprietaire" && <button type="button" className={user.is_verified ? "verification-btn is-verified" : "verification-btn"} disabled={updatingVerificationId === `users-${user.id}`} onClick={() => updateVerification("users", user)}>{updatingVerificationId === `users-${user.id}` ? "Mise à jour..." : user.is_verified ? "✓ Propriétaire vérifié" : "Vérifier propriétaire"}</button>}
                      <span className={`account-status ${user.is_active ? "is-active" : "is-suspended"}`}>{user.is_active ? "Actif" : "Suspendu"}</span>
                      {user.role === "admin" || user.is_current_user ? <span className="account-protected">{user.is_current_user ? "Compte connecté" : "Administrateur protégé"}</span> : <button type="button" className={user.is_active ? "suspend-user-btn" : "activate-user-btn"} disabled={updatingUserId === user.id} onClick={() => updateUserStatus(user)}>{updatingUserId === user.id ? "Mise à jour..." : user.is_active ? "Suspendre" : "Réactiver"}</button>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel verification-section" id="admin-verification" aria-labelledby="verification-listings-title">
            <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">MODÉRATION</span><h2 id="verification-listings-title"><BadgeCheck size={18} /> Vérification des annonces disponibles</h2></div><span className="admin-section-count">{availableProperties.length}</span></div>
            {availableProperties.length === 0 ? <p className="admin-empty">Aucune annonce disponible à vérifier.</p> : <div className="property-list">{availableProperties.map((property) => <article className="admin-property" key={property.id}><div><h3>{property.titre}</h3><p>📍 {property.ville || "Ville non précisée"} · {property.proprietaire_nom || "Propriétaire"}</p><p>💰 {Number(property.prix).toLocaleString("fr-FR")} FCFA</p></div><button type="button" className={property.is_verified ? "verification-btn is-verified" : "verification-btn"} disabled={updatingVerificationId === `properties-${property.id}`} onClick={() => updateVerification("properties", property)}>{updatingVerificationId === `properties-${property.id}` ? "Mise à jour..." : property.is_verified ? "✓ Annonce vérifiée" : "Vérifier l'annonce"}</button></article>)}</div>}
          </section>

          <section className="admin-panel statistics-section" id="admin-overview">
            <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">MODÉRATION</span><h2><ChartNoAxesCombined size={18} /> État des biens</h2></div></div>
            <div className="progress-container">
              {[{ label: "Approuvés", value: stats.approved, className: "progress-approved" }, { label: "En attente", value: stats.pending, className: "progress-pending" }, { label: "Rejetés", value: stats.rejected, className: "progress-rejected" }].map((item) => (
                <div className="progress-item" key={item.label}><span>{item.label}</span><div className="progress-bar"><div className={item.className} style={{ width: `${stats.properties ? (item.value / stats.properties) * 100 : 0}%` }} /></div><strong>{item.value}</strong></div>
              ))}
            </div>
          </section>

          <section className="admin-panel pending-section" id="admin-pending">
            <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">À TRAITER</span><h2><Building2 size={18} /> Biens en attente de validation</h2></div><span className="admin-section-count admin-section-count-alert">{pendingProperties.length}</span></div>
            {filteredPendingProperties.length === 0 ? <p className="admin-empty">{pendingProperties.length ? "Aucun bien ne correspond à la recherche." : "🎉 Aucun bien en attente."}</p> : <div className="property-list">{filteredPendingProperties.map((property) => <article className="admin-property" key={property.id}><div><h3>{property.titre}</h3><p>📍 {property.ville || "Ville non précisée"}</p><p>💰 {Number(property.prix).toLocaleString("fr-FR")} FCFA</p></div><div className="admin-actions"><button type="button" className="approve-btn" onClick={() => approveProperty(property.id)}><Check size={15} /> Approuver</button><button type="button" className="reject-btn" onClick={() => rejectProperty(property.id)}><X size={15} /> Rejeter</button></div></article>)}</div>}
          </section>

          <section className="admin-panel reports-section" id="admin-reports">
            <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">SÉCURITÉ & QUALITÉ</span><h2><CircleX size={18} /> Signalements</h2></div><span className="admin-section-count admin-section-count-alert">{reports.length}</span></div>
            {filteredReports.length === 0 ? <p className="admin-empty">{reports.length ? "Aucun signalement correspondant." : "✅ Aucun signalement en attente."}</p> : <div className="reports-list">{filteredReports.map((report) => <article className="report-card" key={report.id}><div><h3>🏠 {report.property_title}</h3><p><strong>Motif :</strong> {report.reason}</p><p><strong>Utilisateur :</strong> {report.reporter_name}</p><p><strong>Description :</strong> {report.description || "Aucune description"}</p></div><button type="button" onClick={async () => { await fetch(API_URL + "/admin/reports/" + report.id + "/resolve", { method: "PATCH", headers: { Authorization: "Bearer " + token } }); fetchReports(); }}><Check size={15} /> Marquer comme traité</button></article>)}</div>}
          </section>

          <section className="admin-panel reports-section admin-visits-section" id="admin-visits">
            <div className="admin-panel-heading admin-panel-heading-compact"><div><span className="admin-section-kicker">AGENDA DE LA PLATEFORME</span><h2><CalendarDays size={18} /> Gestion des visites de biens</h2></div><span className="admin-section-count">{visits.length}</span></div>
            {filteredVisits.length === 0 ? <p className="admin-empty">{visits.length ? "Aucune visite correspondante." : "Aucune réservation de visite enregistrée."}</p> : <div className="reports-list">{filteredVisits.map((visit) => <article className="report-card admin-visit-card" key={visit.id}><div><h3>🏠 {visit.property_title}</h3><p><strong>Date & heure :</strong> 📅 {visit.visit_date} à ⏰ {visit.visit_time}</p><p><strong>Demandeur :</strong> {visit.client_name} ({visit.client_email})</p><p><strong>Propriétaire :</strong> {visit.owner_name}</p><p><strong>Statut actuel :</strong> <span className={`visit-status visit-status-${visit.status}`}>{visit.status}</span></p></div><div className="admin-visit-actions">{visit.status !== "confirmee" && <button type="button" className="visit-confirm-btn" onClick={() => handleUpdateVisitStatus(visit.id, "confirmee")}>✓ Confirmer</button>}{visit.status !== "terminee" && <button type="button" className="visit-complete-btn" onClick={() => handleUpdateVisitStatus(visit.id, "terminee")}>🏁 Terminée</button>}{visit.status !== "annulee" && <button type="button" className="visit-cancel-btn" onClick={() => handleUpdateVisitStatus(visit.id, "annulee")}>✕ Annuler</button>}</div></article>)}</div>}
          </section>

          <footer className="admin-footer"><span>© {currentYear} IMOVA · L'immobilier autrement.</span><a href="#admin-stats">Retour en haut <ArrowUpRight size={13} /></a></footer>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
