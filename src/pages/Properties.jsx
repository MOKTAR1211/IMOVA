import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PropertyCard from "../components/PropertyCard";
import { Search, RotateCcw, MapPin, SlidersHorizontal, X } from "lucide-react";
import useSEO from "../utils/useSEO";
import { API_URL } from "../config/api";
import { BENIN_COMMUNES, normalizeCommune } from "../data/beninCommunes";
import "./Properties.css";

function Properties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useSEO({
    title: "Toutes les annonces immobilières au Bénin",
    description: "Explorez nos biens disponibles à la vente et en location à Cotonou, Calavi, Parakou et dans tout le Bénin. Filtrez par type, ville et budget.",
  });

  const [searchParams, setSearchParams] = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get("keyword") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [transaction, setTransaction] = useState(searchParams.get("transaction") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (!mobileFiltersOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileFiltersOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (searchParams.get("keyword") !== null) setKeyword(searchParams.get("keyword") || "");
    if (searchParams.get("city") !== null) setCity(searchParams.get("city") || "");
    if (searchParams.get("type") !== null) setType(searchParams.get("type") || "");
    if (searchParams.get("transaction") !== null) setTransaction(searchParams.get("transaction") || "");
    if (searchParams.get("minPrice") !== null) setMinPrice(searchParams.get("minPrice") || "");
    if (searchParams.get("maxPrice") !== null) setMaxPrice(searchParams.get("maxPrice") || "");
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState(1);
  const propertiesPerPage = 9;

  useEffect(() => {
    async function loadProperties() {
      try {
        const response = await fetch(`${API_URL}/properties`);

        if (!response.ok) {
          throw new Error("Impossible de charger les annonces.");
        }

        const data = await response.json();
        setProperties(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProperties();
  }, []);

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const title = property.title || property.titre || "";
      const description = property.description || "";
      const propertyCity = property.city || property.ville || "";
      const propertyLocation = property.location || property.quartier || "";

      const searchText = [title, description, propertyCity, propertyLocation]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesKeyword = searchText.includes(
        keyword.trim().toLowerCase()
      );

      const normalizedCity = normalizeCommune(city);
      const matchesCity =
        !city ||
        normalizeCommune(propertyCity).includes(normalizedCity) ||
        normalizeCommune(propertyLocation).includes(normalizedCity);

      const matchesType =
        !type ||
        (property.type && property.type.toLowerCase() === type.toLowerCase());
      const matchesTransaction =
        !transaction || property.transaction_type === transaction;

      const price = Number(property.price ?? property.prix);
      const matchesMin =
        minPrice === "" ||
        (Number.isFinite(price) && price >= Number(minPrice));

      const matchesMax =
        maxPrice === "" ||
        (Number.isFinite(price) && price <= Number(maxPrice));

      return (
        matchesKeyword &&
        matchesCity &&
        matchesType &&
        matchesTransaction &&
        matchesMin &&
        matchesMax
      );
    });
  }, [properties, keyword, city, type, transaction, minPrice, maxPrice]);

  const totalPages = Math.ceil(
    filteredProperties.length / propertiesPerPage
  );

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * propertiesPerPage;
    return filteredProperties.slice(start, start + propertiesPerPage);
  }, [filteredProperties, currentPage]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);

    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (city) params.set("city", city);
    if (type) params.set("type", type);
    if (transaction) params.set("transaction", transaction);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);

    setSearchParams(params);
    setMobileFiltersOpen(false);
  };

  const applyQuickTransaction = (nextTransaction) => {
    const params = new URLSearchParams(searchParams);
    if (transaction === nextTransaction) {
      setTransaction("");
      params.delete("transaction");
    } else if (!nextTransaction) {
      setTransaction("");
      params.delete("transaction");
    } else {
      setTransaction(nextTransaction);
      params.set("transaction", nextTransaction);
    }
    setCurrentPage(1);
    setSearchParams(params);
  };

  const resetFilters = () => {
    setKeyword("");
    setCity("");
    setType("");
    setTransaction("");
    setMinPrice("");
    setMaxPrice("");
    setCurrentPage(1);
    setSearchParams(new URLSearchParams());
    setMobileFiltersOpen(false);
  };

  const activeFilterCount = [keyword, city, type, transaction, minPrice, maxPrice]
    .filter((value) => value.trim?.() !== "" && value !== "").length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {/* En-tête de page */}
        <header className="mb-8">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
            CATALOGUE IMMOBILIER BÉNIN 🇧🇯
          </p>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Trouvez le bien qui vous correspond
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Parcourez les annonces de maisons, d'appartements, de villas et de terrains, puis filtrez par commune, type de bien et budget.
          </p>
        </header>

        <div className="mb-5 sm:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: "", label: "Tous" },
              { value: "location", label: "À louer" },
              { value: "vente", label: "À vendre" },
            ].map((option) => {
              const isActive = transaction === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => applyQuickTransaction(option.value)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
                    isActive
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm"
            aria-haspopup="dialog"
            aria-expanded={mobileFiltersOpen}
          >
            <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {mobileFiltersOpen && (
          <button
            type="button"
            aria-label="Fermer les filtres"
            onClick={() => setMobileFiltersOpen(false)}
            className="fixed inset-0 z-[998] bg-slate-950/45 sm:hidden"
          />
        )}

        {/* Barre de Filtres Moderne */}
        <form 
          onSubmit={handleSearchSubmit}
          role={mobileFiltersOpen ? "dialog" : undefined}
          aria-modal={mobileFiltersOpen ? "true" : undefined}
          aria-label="Filtres des annonces"
          className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-10 ${
            mobileFiltersOpen
              ? "fixed inset-x-0 bottom-0 z-[999] max-h-[88vh] overflow-y-auto rounded-b-none sm:static sm:max-h-none"
              : "hidden sm:block"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-4 text-sm font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <span>Filtrer les annonces</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:hidden"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Mot-clé */}
            <div>
              <label htmlFor="keyword" className="block text-xs font-semibold text-slate-600 mb-1">
                Mot-clé
              </label>
              <input
                id="keyword"
                type="search"
                placeholder="Ex. : piscine, Tankpè..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-600 transition"
              />
            </div>

            {/* Ville */}
            <div>
              <label htmlFor="city" className="block text-xs font-semibold text-slate-600 mb-1">
                Ville / Commune
              </label>
              <select
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-600 transition bg-white"
              >
                <option value="">Toutes les villes</option>
                {BENIN_COMMUNES.map(({ label, value }) => (
                  <option value={value} key={label}>{label}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label htmlFor="type" className="block text-xs font-semibold text-slate-600 mb-1">
                Type de bien
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-600 transition bg-white"
              >
                <option value="">Tous les types</option>
                <option value="Maison">Maison / Villa</option>
                <option value="Appartement">Appartement</option>
                <option value="Terrain">Terrain / Parcelle</option>
                <option value="Boutique">Boutique / Bureau</option>
              </select>
            </div>

            <div>
              <label htmlFor="transaction" className="block text-xs font-semibold text-slate-600 mb-1">
                Transaction
              </label>
              <select
                id="transaction"
                value={transaction}
                onChange={(e) => setTransaction(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-600 transition bg-white"
              >
                <option value="">Toutes les transactions</option>
                <option value="location">Location</option>
                <option value="vente">Vente</option>
              </select>
            </div>

            {/* Prix Min */}
            <div>
              <label htmlFor="minPrice" className="block text-xs font-semibold text-slate-600 mb-1">
                Prix min (FCFA)
              </label>
              <input
                id="minPrice"
                type="number"
                min="0"
                placeholder="Ex. : 50 000"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-600 transition"
              />
            </div>

            {/* Prix Max */}
            <div>
              <label htmlFor="maxPrice" className="block text-xs font-semibold text-slate-600 mb-1">
                Prix max (FCFA)
              </label>
              <input
                id="maxPrice"
                type="number"
                min="0"
                placeholder="Ex. : 50 000 000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-600 transition"
              />
            </div>
          </div>

          {/* Boutons d'action filtres */}
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-sm shadow-blue-600/30"
            >
              <Search className="w-4 h-4" />
              Appliquer les filtres
            </button>
          </div>
        </form>

        {/* Compteur de résultats */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-bold text-slate-700">
            {filteredProperties.length} bien(s) trouvé(s)
          </p>
          <Link
            to="/carte"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5" />
            Voir sur la carte 🗺️
          </Link>
        </div>

        {/* États : Chargement / Erreur / Liste */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-semibold text-slate-600">Chargement des biens immobiliers...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm">
            {error}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <span className="text-4xl block mb-2">🔍</span>
            <h3 className="text-lg font-bold text-slate-800">Aucun bien ne correspond à ces critères</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Essayez d'élargir votre recherche en modifiant la ville ou la fourchette de prix.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              Effacer les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-12" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
            >
              ← Précédent
            </button>

            <span className="px-4 py-2 text-sm font-bold text-slate-700">
              Page {currentPage} sur {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
            >
              Suivant →
            </button>
          </nav>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default Properties;
