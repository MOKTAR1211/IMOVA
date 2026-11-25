import React, { useState } from 'react';
import { Search, MapPin, Home, Banknote, ArrowRight } from 'lucide-react';
import { BENIN_COMMUNES, getCommuneFilterValue } from '../data/beninCommunes';

export default function SearchBox({ onSearch }) {
  const [propertyType, setPropertyType] = useState('all');
  const [location, setLocation] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({ propertyType, location: getCommuneFilterValue(location), maxPrice });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-100">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Type de bien */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-emerald-600" />
              Type de bien
            </label>
            <div className="relative">
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-sm font-medium rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 px-4 py-3.5 outline-none transition appearance-none cursor-pointer"
              >
                <option value="all">Tous types de biens</option>
                <option value="villa">Maison / Villa</option>
                <option value="apartment">Appartement meublé / non-meublé</option>
                <option value="land">Terrain constructible (Titre Foncier)</option>
                <option value="commercial">Bureau / Local commercial</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Localisation */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Localisation
            </label>
            <div className="relative">
              <input
                list="home-search-communes"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Cotonou, Calavi, Fidjrossè, Porto-Novo..."
                className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-sm font-medium rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 px-4 py-3.5 outline-none transition placeholder:text-slate-400"
              />
              <datalist id="home-search-communes">
                {BENIN_COMMUNES.map(({ label }) => <option value={label} key={label} />)}
              </datalist>
            </div>
          </div>

          {/* Budget maximum */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              Budget maximum (FCFA)
            </label>
            <input
              type="text"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Ex: 150 000 ou 45 000 000"
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-sm font-medium rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 px-4 py-3.5 outline-none transition placeholder:text-slate-400"
            />
          </div>

          {/* Bouton RECHERCHER */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 transition-all flex items-center justify-center gap-2 text-sm tracking-wide uppercase active:scale-[0.99]"
            >
              <Search className="w-4 h-4" />
              <span>Rechercher</span>
              <ArrowRight className="w-4 h-4 ml-1 hidden sm:inline" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
