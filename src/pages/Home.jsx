import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Building2,
  Compass,
  HeartHandshake,
  KeyRound,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PropertyCard from "../components/PropertyCard";
import useSEO from "../utils/useSEO";
import { API_URL } from "../config/api";
import { BENIN_COMMUNES, getCommuneFilterValue } from "../data/beninCommunes";
import "./Home.css";

const POPULAR_CITIES = [
  {
    label: "Cotonou",
    value: "Cotonou",
    landmark: "Esplanade des Amazones",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/Lever_de_soleil_sur_l%27Esplanade_de_l%27amazone_%C3%A0_Cotonou.jpg/960px-Lever_de_soleil_sur_l%27Esplanade_de_l%27amazone_%C3%A0_Cotonou.jpg",
    author: "Fawaz.tairou",
    source: "https://commons.wikimedia.org/wiki/File:Lever_de_soleil_sur_l%27Esplanade_de_l%27amazone_%C3%A0_Cotonou.jpg",
  },
  {
    label: "Abomey-Calavi",
    value: "Calavi",
    landmark: "Monument du rond-point de la Connaissance",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Monument_rond_point_de_la_connaisance_%C3%A0_Tankp%C3%A8_Abomey-Calavi_au_B%C3%A9nin.jpg/960px-Monument_rond_point_de_la_connaisance_%C3%A0_Tankp%C3%A8_Abomey-Calavi_au_B%C3%A9nin.jpg",
    author: "Adoscam",
    source: "https://commons.wikimedia.org/wiki/File:Monument_rond_point_de_la_connaisance_%C3%A0_Tankp%C3%A8_Abomey-Calavi_au_B%C3%A9nin.jpg",
  },
  {
    label: "Porto-Novo",
    value: "Porto-Novo",
    landmark: "Assemblée nationale du Bénin",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Assembl%C3%A9e_Nationale_du_B%C3%A9nin.jpg/960px-Assembl%C3%A9e_Nationale_du_B%C3%A9nin.jpg",
    author: "Ksperentos",
    source: "https://commons.wikimedia.org/wiki/File:Assembl%C3%A9e_Nationale_du_B%C3%A9nin.jpg",
  },
  {
    label: "Parakou",
    value: "Parakou",
    landmark: "Monument de Bio Guéra",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Place_Bio_Guera_de_Parakou_03.jpg/960px-Place_Bio_Guera_de_Parakou_03.jpg",
    author: "Dowomiche",
    source: "https://commons.wikimedia.org/wiki/File:Place_Bio_Guera_de_Parakou_03.jpg",
  },
  {
    label: "Ouidah",
    value: "Ouidah",
    landmark: "Esplanade de la Porte du Non-Retour",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Ouidah-Esplanade_de_la_Porte_du_Non-Retour-C%C3%B4t%C3%A9_oc%C3%A9an_%282%29.jpg/960px-Ouidah-Esplanade_de_la_Porte_du_Non-Retour-C%C3%B4t%C3%A9_oc%C3%A9an_%282%29.jpg",
    author: "Ji-Elle",
    source: "https://commons.wikimedia.org/wiki/File:Ouidah-Esplanade_de_la_Porte_du_Non-Retour-C%C3%B4t%C3%A9_oc%C3%A9an_(2).jpg",
  },
  {
    label: "Bohicon",
    value: "Bohicon",
    landmark: "Statue « L’union fait la force »",
    image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Statut_de_l%27union_fait_la_force_au_Carrefour_Zakpo_%28Bohicon%29.jpg/960px-Statut_de_l%27union_fait_la_force_au_Carrefour_Zakpo_%28Bohicon%29.jpg",
    author: "Tchokponhoue josué",
    source: "https://commons.wikimedia.org/wiki/File:Statut_de_l%27union_fait_la_force_au_Carrefour_Zakpo_(Bohicon).jpg",
  },
];

const IMAGE_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

const BENEFITS = [
  {
    icon: BadgeCheck,
    title: "Annonces vérifiées",
    description: "Repérez les biens vérifiés et consultez leurs informations avant de contacter leur propriétaire.",
  },
  {
    icon: Compass,
    title: "Recherche intelligente",
    description: "Affinez les résultats par commune, transaction, type de bien et budget.",
  },
  {
    icon: WalletCards,
    title: "Paiements intégrés",
    description: "Suivez les paiements Mobile Money liés aux services de la plateforme.",
  },
  {
    icon: HeartHandshake,
    title: "Contact direct",
    description: "Échangez avec les propriétaires et organisez vos visites depuis IMOVA.",
  },
];

function ListingSection({ eyebrow, title, description, properties, loading, error, to = "/biens" }) {
  if (!loading && !error && properties.length === 0) return null;

  return (
    <section className="home-listing-section home-reveal">
      <div className="home-section-heading">
        <div>
          <span className="home-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Link className="home-text-link" to={to}>
          Tout explorer <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <p className="home-listing-message" role="status">Chargement des annonces…</p>
      ) : error ? (
        <p className="home-listing-message" role="alert">
          Les annonces ne sont pas disponibles pour le moment.
        </p>
      ) : (
        <div className="home-listing-grid">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </section>
  );
}

function Home() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchCity, setSearchCity] = useState("");
  const [searchType, setSearchType] = useState("");
  const [searchTransaction, setSearchTransaction] = useState("");
  const [searchMinPrice, setSearchMinPrice] = useState("");
  const [searchMaxPrice, setSearchMaxPrice] = useState("");

  useSEO({
    title: "Annonces immobilières au Bénin",
    description: "Découvrez, achetez et louez des biens immobiliers partout au Bénin en toute simplicité et confiance.",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/properties`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger les annonces.");
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Réponse invalide du serveur.");
        setProperties(data);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Impossible de charger les annonces :", error);
        setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll(".home-reveal");
    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [properties, loading, loadError]);

  const handleSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchType) params.set("type", searchType);
    if (searchCity.trim()) params.set("city", getCommuneFilterValue(searchCity));
    if (searchTransaction) params.set("transaction", searchTransaction);
    if (searchMinPrice) params.set("minPrice", searchMinPrice);
    if (searchMaxPrice) params.set("maxPrice", searchMaxPrice);
    navigate(`/biens${params.size ? `?${params.toString()}` : ""}`);
  };

  const recentProperties = properties.slice(0, 3);
  const popularProperties = [...properties]
    .filter((property) => Number(property.view_count) > 0)
    .sort((a, b) => Number(b.view_count) - Number(a.view_count))
    .slice(0, 3);
  const recommendedProperties = properties
    .filter((property) => property.is_verified)
    .slice(0, 3);
  const coveredCities = new Set(
    properties.map((property) => String(property.city || property.ville || "").trim().toLocaleLowerCase("fr"))
      .filter(Boolean)
  ).size;

  return (
    <div className="home-page">
      <Navbar />

      <main>
        <section className="home-hero">
          <img
            className="home-hero__image"
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=88"
            alt=""
            fetchPriority="high"
          />
          <div className="home-hero__veil" aria-hidden="true" />
          <div className="home-hero__geometry" aria-hidden="true" />

          <div className="home-hero__content">
            <span className="home-hero__eyebrow"><span /> L’immobilier autrement, au Bénin</span>
            <h1>
              Trouvez le lieu où commence <span>votre prochaine histoire.</span>
            </h1>
            <p>
              Découvrez, achetez et louez des biens immobiliers partout au Bénin en toute simplicité et confiance.
            </p>
            <div className="home-hero__actions">
              <Link to="/biens" className="home-button home-button--primary">
                Explorer les biens <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link to="/ajouter-bien" className="home-button home-button--glass">
                Publier une annonce <ArrowDownRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <span className="home-hero__caption">Une nouvelle façon d’habiter le Bénin</span>
        </section>

        <div className="home-search-wrap">
          <form className="home-search" onSubmit={handleSearch}>
            <div className="home-search__field home-search__location">
              <label htmlFor="home-search-city"><MapPin aria-hidden="true" /> Localisation</label>
              <input
                id="home-search-city"
                list="home-communes"
                type="text"
                placeholder="Ville ou commune"
                value={searchCity}
                onChange={(event) => setSearchCity(event.target.value)}
              />
              <datalist id="home-communes">
                {BENIN_COMMUNES.map(({ label }) => <option value={label} key={label} />)}
              </datalist>
            </div>
            <div className="home-search__field">
              <label htmlFor="home-search-transaction"><KeyRound aria-hidden="true" /> Transaction</label>
              <select id="home-search-transaction" value={searchTransaction} onChange={(event) => setSearchTransaction(event.target.value)}>
                <option value="">Vente ou location</option>
                <option value="vente">Vente</option>
                <option value="location">Location</option>
              </select>
            </div>
            <div className="home-search__field">
              <label htmlFor="home-search-type"><Building2 aria-hidden="true" /> Type de bien</label>
              <select id="home-search-type" value={searchType} onChange={(event) => setSearchType(event.target.value)}>
                <option value="">Tous les types</option>
                <option value="Maison">Maison / villa</option>
                <option value="Appartement">Appartement</option>
                <option value="Terrain">Terrain / parcelle</option>
                <option value="Boutique">Boutique / bureau</option>
              </select>
            </div>
            <div className="home-search__field home-search__budget">
              <label htmlFor="home-search-min"><WalletCards aria-hidden="true" /> Budget min.</label>
              <input id="home-search-min" type="number" min="0" inputMode="numeric" placeholder="FCFA" value={searchMinPrice} onChange={(event) => setSearchMinPrice(event.target.value)} />
            </div>
            <div className="home-search__field home-search__budget">
              <label htmlFor="home-search-max">Budget max.</label>
              <input id="home-search-max" type="number" min="0" inputMode="numeric" placeholder="FCFA" value={searchMaxPrice} onChange={(event) => setSearchMaxPrice(event.target.value)} />
            </div>
            <button type="submit" className="home-search__submit">
              <Search size={18} aria-hidden="true" /><span>Rechercher</span>
            </button>
          </form>
        </div>

        <div className="home-content">
          {!loadError && properties.length > 0 && (
            <section className="home-stats home-reveal" aria-label="Chiffres clés basés sur les annonces disponibles">
              <div><strong>{properties.length.toLocaleString("fr-FR")}</strong><span>biens disponibles</span></div>
              <div><strong>{coveredCities.toLocaleString("fr-FR")}</strong><span>villes représentées</span></div>
              <p>Des chiffres calculés à partir des annonces disponibles sur IMOVA.</p>
            </section>
          )}

          <ListingSection
            eyebrow="Les dernières annonces"
            title="Des lieux à découvrir"
            description="Les annonces disponibles récemment publiées sur IMOVA."
            properties={recentProperties}
            loading={loading}
            error={loadError}
          />

          {popularProperties.length > 0 && (
            <ListingSection
              eyebrow="Les plus consultés"
              title="Les biens qui attirent l’attention"
              description="Une sélection classée selon les consultations enregistrées sur la plateforme."
              properties={popularProperties}
            />
          )}

          {recommendedProperties.length > 0 && (
            <ListingSection
              eyebrow="Sélection IMOVA"
              title="Des annonces vérifiées"
              description="Des biens disponibles portant le badge de vérification IMOVA."
              properties={recommendedProperties}
            />
          )}

          <section className="home-cities home-reveal">
            <div className="home-section-heading">
              <div>
                <span className="home-eyebrow">Explorer le Bénin</span>
                <h2>Un projet, une ville</h2>
                <p>Découvrez les monuments contemporains et les annonces de chaque ville.</p>
              </div>
              <Link className="home-text-link" to="/biens">Toutes les villes <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
            <div className="home-city-grid">
              {POPULAR_CITIES.map((city) => (
                <article className="home-city-item" key={city.value}>
                  <Link
                    to={`/biens?city=${encodeURIComponent(city.value)}`}
                    className="home-city-card"
                    aria-label={`Explorer les annonces à ${city.label} : ${city.landmark}`}
                  >
                    <img className="home-city-card__image" src={city.image} alt="" loading="lazy" decoding="async" />
                    <span className="home-city-card__shade" aria-hidden="true" />
                    <span className="home-city-card__marker" aria-hidden="true">
                      <MapPin size={20} />
                    </span>
                    <span className="home-city-card__content">
                      <span className="home-city-card__landmark">{city.landmark}</span>
                      <strong>{city.label}</strong>
                      <span className="home-city-card__action">
                        Voir les annonces <ArrowRight size={15} aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </article>
              ))}
            </div>
            <details className="home-city-credits">
              <summary>Crédits photos</summary>
              <ul>
                {POPULAR_CITIES.map((city) => (
                  <li key={city.value}>
                    {city.label} — <a href={city.source} target="_blank" rel="noopener noreferrer">© {city.author}</a>
                    {" · "}
                    <a href={IMAGE_LICENSE_URL} target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="home-benefits home-reveal">
            <div className="home-section-heading home-section-heading--center">
              <div>
                <span className="home-eyebrow">L’expérience IMOVA</span>
                <h2>La confiance, à chaque étape</h2>
                <p>Les bons outils pour trouver, visiter et échanger en toute sérénité.</p>
              </div>
            </div>
            <div className="home-benefits-grid">
              {BENEFITS.map(({ icon: Icon, title, description }, index) => (
                <article className="home-benefit-card" key={title} style={{ "--card-index": index }}>
                  <span className="home-benefit-icon"><Icon size={22} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="home-owner home-reveal">
            <img
              className="home-owner__image"
              src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85"
              alt=""
              loading="lazy"
            />
            <div className="home-owner__shade" />
            <div className="home-owner__content">
              <span className="home-eyebrow">Vous êtes propriétaire ?</span>
              <h2>Vous possédez un bien immobilier&nbsp;?</h2>
              <p>
                Donnez de la visibilité à votre propriété et trouvez rapidement des locataires ou des acheteurs grâce à IMOVA.
              </p>
              <Link to="/ajouter-bien" className="home-button home-button--primary">
                Publier mon annonce <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="home-trust home-reveal">
            <div className="home-trust__icon"><ShieldCheck size={25} aria-hidden="true" /></div>
            <div>
              <span className="home-eyebrow">Votre projet mérite toute notre attention</span>
              <h2>Un accompagnement pensé pour vos choix immobiliers.</h2>
            </div>
            <Link to="/contact" className="home-text-link">Parler à IMOVA <MessageCircle size={17} aria-hidden="true" /></Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Home;
