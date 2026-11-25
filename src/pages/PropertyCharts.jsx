import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import "./PropertyCharts.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const COLORS = ["#16a34a", "#f59e0b", "#2563eb"];

export default function PropertyCharts() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCharts() {
      try {
        const token = localStorage.getItem("token");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [statsResponse, monthlyResponse] = await Promise.all([
          fetch(`${API_URL}/api/properties/stats/dashboard`, { headers }),
          fetch(`${API_URL}/api/properties/stats/monthly`, { headers }),
        ]);

        const statsData = await statsResponse.json();
        const monthlyData = await monthlyResponse.json();

        if (!statsResponse.ok || !monthlyResponse.ok) {
          throw new Error("Impossible de charger les graphiques.");
        }

        setStats(statsData);
        setMonthly(monthlyData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCharts();
  }, []);

  if (loading) return <p style={{ textAlign: "center", padding: "40px" }}>Chargement des graphiques...</p>;
  if (error) return <p role="alert" style={{ textAlign: "center", padding: "40px", color: "#dc2626" }}>{error}</p>;
  if (!stats) return <p style={{ textAlign: "center", padding: "40px" }}>Aucune statistique disponible.</p>;

  const distribution = [
    { name: "Disponibles", value: Number(stats.disponibles) || 0 },
    { name: "Loués", value: Number(stats.loues) || 0 },
    { name: "Vendus", value: Number(stats.vendus) || 0 },
  ];

  const monthNames = [
    "Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin",
    "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc.",
  ];

  const monthlyData = monthly.map((item) => {
    const parts = (item.month || "").split("-");
    const year = parts[0] || "";
    const month = parts[1] || "1";

    return {
      ...item,
      total: Number(item.total) || 0,
      label: `${monthNames[Number(month) - 1] || month} ${year}`,
    };
  });

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
        </div>
      </nav>

      <main className="charts-page">
        <h1>Statistiques immobilières</h1>
        <p>Visualise l'évolution de tes annonces sur IMOVA.</p>

        <section className="charts-grid">
          <article className="chart-card">
            <h2>Répartition des biens</h2>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label
                  >
                    {distribution.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[index]}
                      />
                    ))}
                  </Pie>

                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="chart-card">
            <h2>Annonces publiées par mois</h2>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="total"
                    name="Annonces"
                    fill="#2563eb"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
