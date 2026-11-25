import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./ActivityStats.css";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function ActivityStats() {
  const [data, setData] = useState(null);
  const [views, setViews] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const token = localStorage.getItem("token");
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [activityRes, viewsRes] = await Promise.all([
          fetch(`${API_URL}/api/properties/stats/activity`, { headers }),
          fetch(`${API_URL}/api/properties/stats/views`, { headers }),
        ]);

        const activityData = await activityRes.json();
        const viewsData = await viewsRes.json();

        if (!activityRes.ok) {
          throw new Error(
            activityData.message || "Impossible de charger les statistiques d'activité."
          );
        }

        if (!viewsRes.ok) {
          throw new Error(
            viewsData.message || "Impossible de charger les consultations."
          );
        }

        setData(activityData);
        setViews(Array.isArray(viewsData) ? viewsData : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div>
        <nav className="navbar">
          <Link to="/" className="logo">
            Immo<span>229</span>
          </Link>
          <div className="nav-links">
            <Link to="/">Accueil</Link>
            <Link to="/biens">Biens</Link>
            <Link to="/messages">💬 Messages</Link>
            <Link to="/my-properties">Mes annonces</Link>
            <Link to="/property-dashboard">Tableau de bord</Link>
            <Link to="/property-charts">Graphiques</Link>
            <Link to="/activity-stats">Activité</Link>
          </div>
        </nav>
        <p style={{ textAlign: "center", padding: "40px" }}>Chargement des statistiques...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <nav className="navbar">
          <Link to="/" className="logo">
            Immo<span>229</span>
          </Link>
          <div className="nav-links">
            <Link to="/">Accueil</Link>
            <Link to="/biens">Biens</Link>
            <Link to="/messages">💬 Messages</Link>
            <Link to="/my-properties">Mes annonces</Link>
            <Link to="/property-dashboard">Tableau de bord</Link>
            <Link to="/property-charts">Graphiques</Link>
            <Link to="/activity-stats">Activité</Link>
          </div>
        </nav>
        <p role="alert" style={{ textAlign: "center", padding: "40px", color: "#dc2626" }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <nav className="navbar">
          <Link to="/" className="logo">
            Immo<span>229</span>
          </Link>
          <div className="nav-links">
            <Link to="/">Accueil</Link>
            <Link to="/biens">Biens</Link>
            <Link to="/messages">💬 Messages</Link>
            <Link to="/my-properties">Mes annonces</Link>
            <Link to="/property-dashboard">Tableau de bord</Link>
            <Link to="/property-charts">Graphiques</Link>
            <Link to="/activity-stats">Activité</Link>
          </div>
        </nav>
        <p style={{ textAlign: "center", padding: "40px" }}>Aucune statistique disponible.</p>
      </div>
    );
  }

  const totalViews = views.reduce(
    (acc, item) => acc + (Number(item.total_views) || 0),
    0
  );

  const cards = [
    {
      label: "Consultations totales",
      value: totalViews,
    },
    {
      label: "Demandes de visite",
      value: data.visites?.total,
    },
    {
      label: "Visites en attente",
      value: data.visites?.en_attente,
    },
    {
      label: "Visites acceptées",
      value: data.visites?.acceptees,
    },
    {
      label: "Conversations",
      value: data.contacts?.total,
    },
  ];

  return (
    <div>
      <nav className="navbar">
        <Link to="/" className="logo">
          Immo<span>229</span>
        </Link>
        <div className="nav-links">
          <Link to="/">Accueil</Link>
          <Link to="/biens">Biens</Link>
          <Link to="/favoris">❤️ Favoris</Link>
          <Link to="/notifications">🔔 Notifications</Link>
          <Link to="/messages">💬 Messages</Link>
          <Link to="/my-properties">Mes annonces</Link>
          <Link to="/property-dashboard">Tableau de bord</Link>
          <Link to="/property-charts">Graphiques</Link>
          <Link to="/activity-stats">Activité</Link>
        </div>
      </nav>

      <main className="activity-stats">
        <h1>Activité de mes biens</h1>
        <p>Consulte les consultations, les visites et les contacts reçus.</p>

        <section className="activity-cards">
          {cards.map((card) => (
            <article key={card.label} className="activity-card">
              <h2>{card.label}</h2>
              <strong>{Number(card.value) || 0}</strong>
            </article>
          ))}
        </section>

        {/* Tableau des consultations (Étape 46) */}
        <section className="activity-table">
          <h2>Consultations par annonce</h2>

          {views.length === 0 ? (
            <p>Aucune consultation disponible.</p>
          ) : (
            <div className="activity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Annonce</th>
                    <th>Nombre de vues</th>
                  </tr>
                </thead>

                <tbody>
                  {views.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.total_views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Tableau de l'intérêt par annonce (visites & contacts) */}
        <section className="activity-table">
          <h2>Intérêt par annonce</h2>

          {!data.annonces || data.annonces.length === 0 ? (
            <p>Aucune annonce disponible.</p>
          ) : (
            <div className="activity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Annonce</th>
                    <th>Visites</th>
                    <th>Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.annonces.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.total_visites}</td>
                      <td>{item.total_contacts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
