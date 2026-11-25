import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BedDouble,
  BellRing,
  Building2,
  CalendarCheck,
  Check,
  CircleDollarSign,
  Headphones,
  Handshake,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BENIN_COMMUNES, getCommuneFilterValue } from "../data/beninCommunes";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import useSEO from "../utils/useSEO";
import "./AdvancedSearch.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const SEARCH_KEYS = ["city", "type", "minPrice", "maxPrice", "bedrooms", "status"];

function getFiltersFromSearchParams(searchParams) {
  return {
    city: searchParams.get("city") || "",
    type: searchParams.get("type") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    bedrooms: searchParams.get("bedrooms") || "",
    status: searchParams.get("status") || "disponible",
  };
}

function SearchField({ id, label, icon: Icon, children }) {
  return (
    <div className="advanced-search-field">
      <label htmlFor={id}>
        <span className="advanced-search-field__icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function AdvancedSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  useSEO({
    title: "Recherche avancée de biens immobiliers au Bénin",
    description: "Filtrez les annonces immobilières au Bénin par ville, type de bien, budget, nombre de chambres et disponibilité.",
  });

  const [filters, setFilters] = useState(() => getFiltersFromSearchParams(searchParams));
  const [filtersSearchKey, setFiltersSearchKey] = useState(() => searchParams.toString());
  const [properties, setProperties] = useState([]);
  const hasInitialSearch = SEARCH_KEYS.some((key) => searchParams.has(key));
  const [loading, setLoading] = useState(hasInitialSearch);
  const [error, setError] = useState("");
  const searched = hasInitialSearch;
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (storageError) {
      console.error("Profil local illisible :", storageError);
      return null;
    }
  });
  const [alerts, setAlerts] = useState([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [savingAlert, setSavingAlert] = useState(false);
  const [deletingAlertId, setDeletingAlertId] = useState(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const hasCriteria = SEARCH_KEYS.some((key) => searchParams.has(key));
    if (!hasCriteria) return undefined;

    const params = new URLSearchParams();
    SEARCH_KEYS.forEach((key) => {
      if (searchParams.has(key)) params.set(key, searchParams.get(key) || "");
    });
    if (!params.has("status")) params.set("status", "disponible");

    let active = true;
    fetch(`${API_URL}/api/properties/search/advanced?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "La recherche a échoué.");
        }
        if (active) setProperties(data);
      })
      .catch((searchError) => {
        if (active) {
          setError(searchError.message);
          setProperties([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (currentUser?.role !== "client" || !token) return;

    let cancelled = false;
    fetch(`${API_URL}/api/search-alerts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Impossible de charger vos alertes.");
        if (!cancelled) setAlerts(data);
      })
      .catch((loadError) => {
        if (!cancelled) setAlertMessage(loadError.message);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, token]);

  if (filtersSearchKey !== searchParams.toString()) {
    const hasCriteria = SEARCH_KEYS.some((key) => searchParams.has(key));
    setFiltersSearchKey(searchParams.toString());
    setFilters(getFiltersFromSearchParams(searchParams));
    setLoading(hasCriteria);
    setError("");
  }

  function updateFilter(event) {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function searchProperties(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") {
        params.set(key, key === "city" ? getCommuneFilterValue(value) : value);
      }
    });

    if (params.toString() === searchParams.toString()) {
      try {
        const response = await fetch(
          `${API_URL}/api/properties/search/advanced?${params.toString()}`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "La recherche a échoué.");
        setProperties(data);
      } catch (searchError) {
        setError(searchError.message);
        setProperties([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setSearchParams(params);
  }

  async function saveSearchAlert() {
    const criteria = {
      city: filters.city ? getCommuneFilterValue(filters.city) : "",
      type: filters.type,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      bedrooms: filters.bedrooms,
    };
    if (!Object.values(criteria).some((value) => value !== "")) {
      setAlertMessage("Ajoutez au moins un critère avant d'enregistrer une alerte.");
      return;
    }

    setSavingAlert(true);
    setAlertMessage("");
    try {
      const response = await fetch(`${API_URL}/api/search-alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(criteria),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible d'enregistrer cette alerte.");
      setAlerts((current) => [data.alert, ...current]);
      setAlertMessage("Alerte enregistrée. Vous serez prévenu des nouveaux biens disponibles.");
    } catch (saveError) {
      setAlertMessage(saveError.message);
    } finally {
      setSavingAlert(false);
    }
  }

  async function deleteSearchAlert(alertId) {
    setDeletingAlertId(alertId);
    setAlertMessage("");
    try {
      const response = await fetch(`${API_URL}/api/search-alerts/${alertId}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de supprimer cette alerte.");
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
    } catch (deleteError) {
      setAlertMessage(deleteError.message);
    } finally {
      setDeletingAlertId(null);
    }
  }

  function describeAlert(alert) {
    const details = [
      alert.city,
      alert.type,
      alert.min_price != null && `Dès ${Number(alert.min_price).toLocaleString("fr-FR")} FCFA`,
      alert.max_price != null && `Jusqu'à ${Number(alert.max_price).toLocaleString("fr-FR")} FCFA`,
      alert.min_bedrooms != null && `${alert.min_bedrooms} chambre(s) min.`,
    ].filter(Boolean);
    return details.join(" · ");
  }

  return (
    <div className="advanced-search-page">
      <Navbar />

      <main>
        <section className="advanced-search-hero" aria-labelledby="advanced-search-title">
          <div className="advanced-search-hero__content">
            <span className="advanced-search-hero__eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              Recherche avancée
            </span>
            <h1 id="advanced-search-title">Trouvez le bien idéal au Bénin</h1>
            <p>Filtrez votre recherche pour trouver exactement ce que vous cherchez.</p>
            <div className="advanced-search-hero__trust">
              <span><Check size={15} aria-hidden="true" /> Des critères précis</span>
              <span><MapPin size={15} aria-hidden="true" /> Partout au Bénin</span>
            </div>
          </div>
          <div className="advanced-search-hero__art" aria-hidden="true">
            <div className="advanced-search-hero__sun" />
            <div className="advanced-search-hero__building advanced-search-hero__building--back" />
            <div className="advanced-search-hero__building advanced-search-hero__building--front">
              <span /><span /><span /><span />
            </div>
            <div className="advanced-search-hero__ground" />
          </div>
        </section>

        <div className="advanced-search-layout">
          <section className="advanced-search-panel" aria-labelledby="search-panel-title">
            <div className="advanced-search-panel__heading">
              <span className="advanced-search-panel__icon">
                <Search size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 id="search-panel-title">Recherche avancée</h2>
                <p>Affinez votre recherche avec des critères précis</p>
              </div>
            </div>

            <form onSubmit={searchProperties} className="search-form">
              <SearchField id="advanced-search-city" label="Ville" icon={MapPin}>
                <input
                  id="advanced-search-city"
                  list="advanced-search-communes"
                  name="city"
                  value={filters.city}
                  onChange={updateFilter}
                  placeholder="Ex. Cotonou, Calavi..."
                />
                <datalist id="advanced-search-communes">
                  {BENIN_COMMUNES.map(({ label }) => <option value={label} key={label} />)}
                </datalist>
              </SearchField>

              <SearchField id="advanced-search-type" label="Type de bien" icon={Building2}>
                <select
                  id="advanced-search-type"
                  name="type"
                  value={filters.type}
                  onChange={updateFilter}
                >
                  <option value="">Tous les types</option>
                  <option value="maison">Maison</option>
                  <option value="appartement">Appartement</option>
                  <option value="parcelle">Parcelle</option>
                </select>
              </SearchField>

              <SearchField id="advanced-search-min-price" label="Budget minimum (FCFA)" icon={CircleDollarSign}>
                <input
                  id="advanced-search-min-price"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  name="minPrice"
                  value={filters.minPrice}
                  onChange={updateFilter}
                  placeholder="0"
                />
              </SearchField>

              <SearchField id="advanced-search-max-price" label="Budget maximum (FCFA)" icon={CircleDollarSign}>
                <input
                  id="advanced-search-max-price"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  name="maxPrice"
                  value={filters.maxPrice}
                  onChange={updateFilter}
                  placeholder="Ex. 10000000"
                />
              </SearchField>

              <SearchField id="advanced-search-bedrooms" label="Chambres minimum" icon={BedDouble}>
                <select
                  id="advanced-search-bedrooms"
                  name="bedrooms"
                  value={filters.bedrooms}
                  onChange={updateFilter}
                >
                  <option value="">Indifférent</option>
                  <option value="1">1 chambre ou plus</option>
                  <option value="2">2 chambres ou plus</option>
                  <option value="3">3 chambres ou plus</option>
                  <option value="4">4 chambres ou plus</option>
                </select>
              </SearchField>

              <SearchField id="advanced-search-status" label="Disponibilité" icon={CalendarCheck}>
                <select
                  id="advanced-search-status"
                  name="status"
                  value={filters.status}
                  onChange={updateFilter}
                >
                  <option value="disponible">Disponible</option>
                  <option value="loue">Loué</option>
                  <option value="vendu">Vendu</option>
                  <option value="all">Tous les statuts</option>
                </select>
              </SearchField>

              <div className="search-form__actions">
                <button type="submit" className="advanced-search-submit" disabled={loading && searched}>
                  <Search size={19} aria-hidden="true" />
                  {loading && searched ? "Recherche en cours..." : "Rechercher"}
                </button>
                {currentUser?.role === "client" && filters.status === "disponible" && (
                  <button
                    type="button"
                    className="save-search-alert-button"
                    disabled={savingAlert}
                    onClick={saveSearchAlert}
                  >
                    <BellRing size={17} aria-hidden="true" />
                    {savingAlert ? "Enregistrement..." : "Créer une alerte pour cette recherche"}
                  </button>
                )}
              </div>
            </form>
          </section>

          {error && <p role="alert" className="advanced-search-error">{error}</p>}
          {alertMessage && (
            <p role="status" className="search-alert-feedback">{alertMessage}</p>
          )}

          <section className="advanced-search-trust" aria-label="Nos engagements">
            <div>
              <span><ShieldCheck size={19} aria-hidden="true" /></span>
              <p><strong>Transactions sécurisées</strong><small>Vos démarches en confiance</small></p>
            </div>
            <div>
              <span><Handshake size={19} aria-hidden="true" /></span>
              <p><strong>Accompagnement personnalisé</strong><small>À chaque étape de votre projet</small></p>
            </div>
            <div>
              <span><Headphones size={19} aria-hidden="true" /></span>
              <p><strong>Support 24/7</strong><small>Nous sommes là pour vous aider</small></p>
            </div>
          </section>

          {currentUser?.role === "client" && (
            <section className="saved-search-alerts" aria-labelledby="saved-alerts-title">
              <div className="saved-search-alerts__heading">
                <span><BellRing size={18} aria-hidden="true" /></span>
                <h2 id="saved-alerts-title">Mes alertes de recherche</h2>
              </div>
              {alerts.length === 0 ? (
                <p>Aucune alerte enregistrée. Enregistrez une recherche de biens disponibles.</p>
              ) : (
                <ul>
                  {alerts.map((alert) => (
                    <li key={alert.id}>
                      <span>{describeAlert(alert) || "Tous les nouveaux biens disponibles"}</span>
                      <button
                        type="button"
                        disabled={deletingAlertId === alert.id}
                        onClick={() => deleteSearchAlert(alert.id)}
                      >
                        {deletingAlertId === alert.id ? "Suppression..." : "Supprimer"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {searched && (
            <section className="advanced-search-results" aria-live="polite">
              <div className="advanced-search-results__heading">
                <div>
                  <span>RÉSULTATS</span>
                  <h2>{loading ? "Recherche en cours..." : `${properties.length} bien(s) trouvé(s)`}</h2>
                </div>
                {properties.length > 0 && <span className="advanced-search-results__count">{properties.length}</span>}
              </div>
              {searched && !loading && !error && properties.length === 0 && (
                <p className="advanced-search-empty">Aucun bien ne correspond à vos critères. Essayez d’élargir votre recherche.</p>
              )}

              <div className="search-results">
                {properties.map((property) => (
                  <article className="search-property" key={property.id}>
                    {property.image_url && (
                      <img
                        src={
                          property.image_url.startsWith("http")
                            ? property.image_url
                            : `${API_URL}${property.image_url}`
                        }
                        alt={property.title || property.titre}
                        loading="lazy"
                      />
                    )}

                    <div className="search-property__content">
                      <div className="search-property__badges">
                        {property.is_verified && <span><Check size={13} aria-hidden="true" /> Annonce vérifiée</span>}
                        {property.owner_is_verified && <span><Check size={13} aria-hidden="true" /> Propriétaire vérifié</span>}
                      </div>
                      <h3>{property.title || property.titre}</h3>
                      <p className="search-property__location"><MapPin size={15} aria-hidden="true" /> {property.city || property.ville}</p>
                      <strong className="search-property__price">
                        {Number(property.price || property.prix).toLocaleString("fr-FR")} FCFA
                      </strong>
                      <p className="search-property__status">
                        Disponibilité : <span data-status={property.status}>{property.status}</span>
                      </p>
                      <Link to={`/properties/${property.id}`}>
                        Voir le bien <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
