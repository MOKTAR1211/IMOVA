import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bath,
  BedDouble,
  Building2,
  ChevronDown,
  LocateFixed,
  MapPin,
  Maximize2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import FavoriteButton from "../components/FavoriteButton";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";
import "./PropertyMap.css";

const initialCenter = [9.3077, 2.3158];

function isLocated(property) {
  const lat = Number(property.latitude);
  const lng = Number(property.longitude);
  return property.latitude != null
    && property.longitude != null
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
}

function propertyPrice(property) {
  const price = Number(property.price ?? property.prix);
  if (!Number.isFinite(price)) return "Prix sur demande";
  return `${price.toLocaleString("fr-FR")} FCFA${property.transaction_type === "location" ? "/mois" : ""}`;
}

function propertyImage(property) {
  const image = property.image_url || (property.image && !property.image.includes("unsplash.com") ? property.image : "");
  if (!image) return "";
  return image.startsWith("http") ? image : `${API_URL}${image}`;
}

function propertyLabel(property) {
  return property.title || property.titre || "Bien immobilier";
}

function propertyLocation(property) {
  return [property.city || property.ville, property.district || property.quartier]
    .filter(Boolean)
    .join(", ") || "Bénin";
}

function markerIcon(property, selected) {
  const price = Number(property.price ?? property.prix);
  const label = Number.isFinite(price) ? `${price.toLocaleString("fr-FR")} F` : "Bien";
  const statusClass = property.status === "disponible" ? "is-available" : "is-unavailable";
  return L.divIcon({
    className: "imova-marker-wrapper",
    html: `<span class="imova-price-marker ${statusClass}${selected ? " is-selected" : ""}"><span class="imova-marker-pin"></span>${label}</span>`,
    iconSize: [112, 42],
    iconAnchor: [56, 42],
    popupAnchor: [0, -42],
  });
}

function MapViewport({ properties, selectedProperty, locateRequest, onLocationError }) {
  const map = useMap();

  useEffect(() => {
    if (!properties.length) return;
    const bounds = L.latLngBounds(properties.map((property) => [
      Number(property.latitude),
      Number(property.longitude),
    ]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 14 });
    }
  }, [properties, map]);

  useEffect(() => {
    if (!selectedProperty) return;
    map.flyTo(
      [Number(selectedProperty.latitude), Number(selectedProperty.longitude)],
      Math.max(map.getZoom(), 14),
      { duration: 0.6 }
    );
  }, [map, selectedProperty]);

  useEffect(() => {
    if (!locateRequest) return;
    map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true });
    map.once("locationerror", onLocationError);
    return () => {
      map.off("locationerror", onLocationError);
    };
  }, [locateRequest, map, onLocationError]);

  return null;
}

function MapControls({ onLocate, onFullscreen, onToggleResults, resultsOpen }) {
  const map = useMap();
  return (
    <div className="map-control-stack" aria-label="Contrôles de la carte">
      <button type="button" onClick={() => map.zoomIn()} aria-label="Zoom avant">+</button>
      <button type="button" onClick={() => map.zoomOut()} aria-label="Zoom arrière">−</button>
      <span className="map-control-divider" />
      <button type="button" onClick={onLocate} aria-label="Me localiser" title="Me localiser">
        <LocateFixed size={18} />
      </button>
      <button type="button" onClick={onFullscreen} aria-label="Plein écran" title="Plein écran">
        <Maximize2 size={17} />
      </button>
      <button type="button" className="results-toggle" onClick={onToggleResults} aria-label={resultsOpen ? "Masquer les annonces" : "Afficher les annonces"} title={resultsOpen ? "Masquer les annonces" : "Afficher les annonces"}>
        <SlidersHorizontal size={17} />
      </button>
    </div>
  );
}

function PropertyDetails({ property, compact = false }) {
  const image = propertyImage(property);
  const bedrooms = Number(property.bedrooms ?? property.chambres ?? 0);
  const bathrooms = Number(property.bathrooms ?? property.douches ?? 0);
  return (
    <div className={`map-property-card${compact ? " is-compact" : ""}`}>
      {image ? (
        <img className="map-property-image" src={image} alt={propertyLabel(property)} loading="lazy" />
      ) : (
        <div className="map-property-image map-property-image-placeholder"><Building2 size={28} /></div>
      )}
      <div className="map-property-content">
        <div className="map-property-card-topline">
          <span className={`map-status-badge ${property.status === "disponible" ? "is-available" : "is-unavailable"}`}>
            {property.status === "disponible" ? "Disponible" : property.status || "Statut inconnu"}
          </span>
          <FavoriteButton propertyId={property.id} />
        </div>
        <strong className="map-property-price">{propertyPrice(property)}</strong>
        <h3>{propertyLabel(property)}</h3>
        <p className="map-property-location"><MapPin size={14} />{propertyLocation(property)}</p>
        <div className="map-property-facts">
          {property.type && <span>{property.type}</span>}
          {bedrooms > 0 && <span><BedDouble size={14} />{bedrooms} ch.</span>}
          {bathrooms > 0 && <span><Bath size={14} />{bathrooms} sdb</span>}
        </div>
        <Link className="map-property-link" to={`/bien/${property.id}`}>Voir le bien</Link>
      </div>
    </div>
  );
}

export default function PropertyMap() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [transaction, setTransaction] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [sortRecent, setSortRecent] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [locateRequest, setLocateRequest] = useState(0);
  const [locationError, setLocationError] = useState("");
  const mapFrameRef = useRef(null);
  const propertyRefs = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    async function loadProperties() {
      try {
        const response = await fetch(`${API_URL}/properties`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Impossible de charger les annonces.");
        if (!Array.isArray(data)) throw new Error("Le format des annonces est incorrect.");
        setProperties(data);
      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadProperties();
    return () => controller.abort();
  }, []);

  const locatedProperties = useMemo(() => properties.filter(isLocated), [properties]);
  const missingCoordinates = properties.length - locatedProperties.length;

  const filteredProperties = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("fr");
    const place = location.trim().toLocaleLowerCase("fr");
    const results = locatedProperties.filter((property) => {
      const propertyType = (property.type || "").toLocaleLowerCase("fr");
      const title = propertyLabel(property).toLocaleLowerCase("fr");
      const propertyPlace = propertyLocation(property).toLocaleLowerCase("fr");
      const amount = Number(property.price ?? property.prix);
      const matchesText = !term || `${title} ${propertyPlace} ${propertyType}`.includes(term);
      const matchesPlace = !place || propertyPlace.includes(place);
      const matchesType = quickFilter === "all" || (
        quickFilter === "house" ? propertyType.includes("maison")
          : quickFilter === "apartment" ? propertyType.includes("appartement")
            : quickFilter === "land" ? propertyType.includes("terrain")
              : quickFilter === "sale" ? property.transaction_type === "vente"
                : quickFilter === "rent" ? property.transaction_type === "location"
                  : true
      );
      const matchesSelectedType = !type || propertyType === type.toLocaleLowerCase("fr");
      const matchesTransaction = !transaction || property.transaction_type === transaction;
      const matchesBudget = !maxPrice || (Number.isFinite(amount) && amount <= Number(maxPrice));
      return matchesText && matchesPlace && matchesType && matchesSelectedType && matchesTransaction && matchesBudget;
    });
    return sortRecent
      ? [...results].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      : results;
  }, [locatedProperties, search, location, type, transaction, maxPrice, quickFilter, sortRecent]);

  const selectedProperty = filteredProperties.find((property) => String(property.id) === String(selectedId)) || null;
  const hasActiveFilters = Boolean(
    search.trim() || location.trim() || type || transaction || maxPrice || quickFilter !== "all"
  );

  useEffect(() => {
    if (!selectedId) return;
    propertyRefs.current.get(String(selectedId))?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const handleLocationError = useCallback((event) => {
    setLocationError(event.message || "Votre position n’a pas pu être déterminée.");
  }, []);

  const handleLocate = () => {
    setLocationError("");
    setLocateRequest((request) => request + 1);
  };

  const resetFilters = () => {
    setSearch("");
    setLocation("");
    setType("");
    setTransaction("");
    setMaxPrice("");
    setQuickFilter("all");
    setSortRecent(false);
    setSelectedId(null);
  };

  const toggleFullscreen = async () => {
    if (!mapFrameRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await mapFrameRef.current.requestFullscreen();
    }
  };

  const quickFilters = [
    ["all", "Tous"],
    ["house", "Maisons"],
    ["apartment", "Appartements"],
    ["land", "Terrains"],
    ["sale", "Vente"],
    ["rent", "Location"],
  ];

  return (
    <>
      <Navbar />
      <main className="property-map-page">
        <div className={`property-map-frame${resultsOpen ? "" : " has-results-hidden"}`} ref={mapFrameRef}>
          <MapContainer
            center={initialCenter}
            zoom={7}
            scrollWheelZoom
            zoomControl={false}
            className="property-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewport
              properties={filteredProperties}
              selectedProperty={selectedProperty}
              locateRequest={locateRequest}
              onLocationError={handleLocationError}
            />
            <MapControls
              onLocate={handleLocate}
              onFullscreen={toggleFullscreen}
              onToggleResults={() => setResultsOpen((open) => !open)}
              resultsOpen={resultsOpen}
            />
            {filteredProperties.map((property) => (
              <Marker
                key={property.id}
                icon={markerIcon(
                  property,
                  String(selectedId) === String(property.id) || String(hoveredId) === String(property.id)
                )}
                position={[Number(property.latitude), Number(property.longitude)]}
                eventHandlers={{
                  mouseover: () => setHoveredId(property.id),
                  mouseout: () => setHoveredId(null),
                  click: () => {
                    setSelectedId(property.id);
                    setResultsOpen(true);
                  },
                }}
              >
                <Popup className="imova-leaflet-popup" minWidth={260} maxWidth={300}>
                  <PropertyDetails property={property} compact />
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <header className="map-explorer-heading">
            <span className="map-brand-kicker">L’IMMOBILIER AUTREMENT</span>
            <h1>Explorer les biens</h1>
            <p>Les annonces disponibles, à découvrir sur la carte.</p>
          </header>

          <section className="map-search-panel" aria-label="Rechercher un bien">
            <form
              className="map-search-form"
              onSubmit={(event) => {
                event.preventDefault();
                setQuickFilter("all");
                setSelectedId(null);
              }}
            >
              <label className="map-search-field map-location-field">
                <MapPin size={18} />
                <span>Localisation</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ville ou quartier" />
              </label>
              <label className="map-search-field">
                <Building2 size={18} />
                <span>Type de bien</span>
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">Tous les types</option>
                  <option value="Maison">Maison</option>
                  <option value="Appartement">Appartement</option>
                  <option value="Terrain">Terrain</option>
                  <option value="Boutique">Boutique</option>
                </select>
              </label>
              <label className="map-search-field">
                <span className="map-field-symbol">↕</span>
                <span>Transaction</span>
                <select value={transaction} onChange={(event) => setTransaction(event.target.value)}>
                  <option value="">Vente / location</option>
                  <option value="vente">Vente</option>
                  <option value="location">Location</option>
                </select>
              </label>
              <label className="map-search-field">
                <span className="map-field-symbol">₣</span>
                <span>Budget max.</span>
                <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
                  <option value="">Tous les budgets</option>
                  <option value="25000000">Jusqu’à 25 M</option>
                  <option value="50000000">Jusqu’à 50 M</option>
                  <option value="100000000">Jusqu’à 100 M</option>
                  <option value="250000000">Jusqu’à 250 M</option>
                </select>
              </label>
              <label className="map-search-keyword">
                <Search size={16} aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mot-clé ou annonce" aria-label="Rechercher une annonce" />
              </label>
              <button className="map-search-submit" type="submit"><Search size={17} /><span>Rechercher</span></button>
            </form>
            <div className="map-quick-filters" role="group" aria-label="Filtres rapides">
              {quickFilters.map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={quickFilter === id ? "is-active" : ""}
                  aria-pressed={quickFilter === id}
                  onClick={() => {
                    setQuickFilter(id);
                    setSelectedId(null);
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={`map-sort-filter${sortRecent ? " is-active" : ""}`}
                aria-pressed={sortRecent}
                onClick={() => setSortRecent((recent) => !recent)}
              >
                Plus récents <ChevronDown size={14} />
              </button>
            </div>
          </section>

          {resultsOpen && (
            <aside className="map-results-panel" aria-label="Annonces dans cette zone">
              <div className="map-results-heading">
                <div>
                  <span className="map-brand-kicker">SÉLECTION IMOVA</span>
                  <h2>Biens disponibles <span>dans cette zone</span></h2>
                  <p>{filteredProperties.length} bien{filteredProperties.length === 1 ? "" : "s"} géolocalisé{filteredProperties.length === 1 ? "" : "s"}</p>
                </div>
                <button type="button" className="map-panel-close" onClick={() => setResultsOpen(false)} aria-label="Masquer les annonces"><X size={18} /></button>
              </div>
              {loading ? (
                <div className="map-state"><span className="map-loading-spinner" />Chargement des annonces…</div>
              ) : error ? (
                <div className="map-state map-error" role="alert">{error}</div>
              ) : filteredProperties.length ? (
                <div className="map-results-list">
                  {filteredProperties.map((property) => (
                    <article
                      key={property.id}
                      ref={(node) => {
                        if (node) propertyRefs.current.set(String(property.id), node);
                        else propertyRefs.current.delete(String(property.id));
                      }}
                      className={`map-result-item${String(selectedId) === String(property.id) || String(hoveredId) === String(property.id) ? " is-selected" : ""}`}
                      onMouseEnter={() => setHoveredId(property.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <button
                        type="button"
                        className="map-result-select"
                        onClick={() => setSelectedId(property.id)}
                        aria-label={`Afficher ${propertyLabel(property)} sur la carte`}
                      >
                        {propertyImage(property) ? (
                          <img src={propertyImage(property)} alt="" loading="lazy" />
                        ) : (
                          <span className="map-result-image-placeholder"><Building2 size={20} /></span>
                        )}
                        <span className="map-result-image-badge">{property.type || "Bien"}</span>
                      </button>
                      <div className="map-result-info">
                        <div className="map-result-title-line">
                          <strong>{propertyPrice(property)}</strong>
                          <FavoriteButton propertyId={property.id} />
                        </div>
                        <h3>{propertyLabel(property)}</h3>
                        <p><MapPin size={13} />{propertyLocation(property)}</p>
                        <div className="map-result-bottom">
                          <span className={`map-status-badge ${property.status === "disponible" ? "is-available" : "is-unavailable"}`}>
                            {property.status === "disponible" ? "Disponible" : property.status || "Statut inconnu"}
                          </span>
                          <Link to={`/bien/${property.id}`}>Voir le bien</Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="map-empty-state">
                  <span className="map-empty-icon"><MapPin size={25} /></span>
                  <h3>{hasActiveFilters && locatedProperties.length ? "Aucun bien ne correspond à ces filtres" : "Découvrez les biens autour de vous"}</h3>
                  <p>{hasActiveFilters && locatedProperties.length
                    ? "Modifiez vos critères ou effacez les filtres pour voir les autres annonces géolocalisées."
                    : "Les annonces disposant de coordonnées géographiques apparaîtront automatiquement sur la carte."}</p>
                  {!locatedProperties.length && missingCoordinates > 0 && (
                    <small>{missingCoordinates} annonce{missingCoordinates === 1 ? "" : "s"} sans localisation disponible n’apparaît{missingCoordinates === 1 ? "" : "ssent"} pas sur la carte.</small>
                  )}
                  {hasActiveFilters && locatedProperties.length
                    ? <button type="button" onClick={resetFilters}>Effacer les filtres</button>
                    : <Link to="/biens">Explorer les biens</Link>}
                </div>
              )}
            </aside>
          )}

          {selectedProperty && (
            <div className="map-mobile-selection">
              <button type="button" className="map-mobile-selection-close" onClick={() => setSelectedId(null)} aria-label="Fermer la fiche"><X size={17} /></button>
              <PropertyDetails property={selectedProperty} compact />
            </div>
          )}

          {!loading && !error && locationError && (
            <p className="map-location-error" role="status">{locationError}</p>
          )}
        </div>
      </main>
    </>
  );
}
