import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Tag, Ruler, Phone } from 'lucide-react';
import FavoriteButton from './FavoriteButton';

export default function PropertyCard({ property }) {
  if (!property) return null;

  const fallbackImage =
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80";

  const id = property.id;
  const title = property.title || property.titre || "Bien immobilier";
  const type = property.type || "Maison";
  const rawStatus = (property.status || "disponible").toLowerCase();
  
  // Formatage du statut
  const statusLabel = 
    rawStatus === "loue" ? "Loué" : 
    rawStatus === "vendu" ? "Vendu" : 
    "Disponible";

  const statusBg = 
    rawStatus === "loue" ? "bg-amber-600" : 
    rawStatus === "vendu" ? "bg-red-600" : 
    "bg-blue-600";

  // Prix en FCFA
  const rawPrice = property.price !== undefined ? property.price : property.prix;
  const priceFormatted = 
    property.priceFormatted || 
    (rawPrice ? `${Number(rawPrice).toLocaleString("fr-FR")} FCFA` : "Prix sur demande");

  const city = property.city || property.ville || "Bénin";
  const district = property.district || property.quartier || "";
  const locationText = district ? `${city}, ${district}` : (property.location || city);

  // Chambres & Salles de bain
  const bedrooms =
    property.bedrooms ??
    property.chambres ??
    String(property.rooms || "").match(/\d+/)?.[0] ??
    0;
  const bathrooms = property.bathrooms !== undefined ? property.bathrooms : (property.douches ?? 0);
  const surface = property.surface ?? property.surface_m2 ?? property.area;

  // Image principale
  const originalImage = property.image || property.image_url || fallbackImage;
  const imageUrl = originalImage.includes("/upload/")
    ? originalImage.replace(
        "/upload/",
        "/upload/f_auto,q_auto,c_fill,g_auto,w_800,h_500/"
      )
    : originalImage;
  const ownerPhone = property.owner?.telephone || property.owner_phone;
  const callHref = ownerPhone
    ? `tel:${String(ownerPhone).replace(/[^\d+]/g, "")}`
    : null;

  return (
    <div className="imova-property-card group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 flex flex-col relative">
      
      {/* Conteneur Image */}
      <Link to={`/bien/${id}`} className="block relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          onError={(event) => {
            if (event.currentTarget.src !== fallbackImage) {
              event.currentTarget.src = fallbackImage;
            }
          }}
        />

        {/* Badges Statut & Type */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider text-white shadow-sm ${statusBg}`}>
            {statusLabel}
          </span>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900/80 backdrop-blur-md text-white">
            {type}
          </span>
        </div>

        {/* Prix en FCFA sur l'image */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-white/50">
          <p className="text-base font-extrabold text-slate-900">
            {priceFormatted}
          </p>
        </div>
      </Link>

      {/* Bouton Favoris (Position absolue en haut à droite) */}
      <div className="absolute top-2.5 right-2.5 z-20">
        <FavoriteButton propertyId={id} />
      </div>

      {/* Contenu de la carte */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <Link to={`/bien/${id}`} className="block group-hover:text-blue-700 transition-colors">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>

          <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
            {title}
          </h3>
          {property.transaction_type && (
            <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold capitalize text-blue-700">
              {property.transaction_type}
            </span>
          )}
        </Link>

        {/* Caractéristiques (Chambres, Salles d'eau, etc.) */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          {Number(bedrooms) > 0 ? (
            <div className="flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-slate-400" />
              <span>{bedrooms} ch.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-slate-400" />
              <span>{type.toLowerCase().includes("terrain") ? "Terrain nu" : "Studio"}</span>
            </div>
          )}

          {Number(bathrooms) > 0 && (
            <div className="flex items-center gap-1.5">
              <Bath className="w-4 h-4 text-slate-400" />
              <span>{bathrooms} douches</span>
            </div>
          )}

          {Number(surface) > 0 && (
            <div className="flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-slate-400" />
              <span>{surface} m²</span>
            </div>
          )}

          <Link
            to={`/bien/${id}`}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          >
            Voir le bien →
          </Link>
        </div>
        {callHref && (
          <a
            href={callHref}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            aria-label={`Appeler le propriétaire du bien ${title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Appeler
          </a>
        )}
      </div>
    </div>
  );
}
