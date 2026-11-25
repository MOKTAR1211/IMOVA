import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import useSEO from "../utils/useSEO";
import {
  Building2,
  Target,
  MapPin,
  Sparkles,
  Smartphone,
  Code2,
  Heart,
  Mail,
  ArrowRight,
  Layers,
  Compass,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import "./APropos.css";

export default function APropos() {
  useSEO({
    title: "À propos d'IMOVA & du Développeur Moktar ADEOTI",
    description:
      "Découvrez la mission d'IMOVA pour l'immobilier au Bénin et le profil de son concepteur Moktar ADEOTI, développeur Flutter basé à Abomey-Calavi.",
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Navbar />

      <main className="flex-1">
        {/* ═══════════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════════ */}
        <section className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="max-w-4xl mx-auto relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Vision & Écosystème IMOVA 🇧🇯
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Un outil pour chercher un bien au Bénin
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              IMOVA rassemble des annonces de biens immobiliers et des outils pour faciliter la recherche et la prise de contact.
            </p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
          {/* ═══════════════════════════════════════════════════════════
              SECTION 1 : À PROPOS D'IMOVA (OBJECTIF & RÔLE)
          ═══════════════════════════════════════════════════════════ */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-10 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  La Plateforme
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  À propos d'IMOVA
                </h2>
              </div>
            </div>

            {/* Objectif & Rôle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-10">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      Notre Objectif
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Permettre de consulter et publier des annonces de logements et de terrains au Bénin, avec des filtres par type de bien et par commune.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      Notre Rôle
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Réunir sur un même site les fiches de biens, leur localisation lorsqu'elle est renseignée, les demandes de visite et les échanges entre clients et propriétaires.
                    </p>
                  </div>
                </div>
              </div>

              {/* Piliers */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-5 space-y-3.5">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Ce que propose le site :
                </h4>
                <div className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Informations pratiques :</strong> prix en FCFA, caractéristiques et photos lorsqu'elles sont renseignées dans l'annonce.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Demandes de visite :</strong> envoyez une demande depuis la fiche du bien et suivez son statut dans votre espace.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Carte des biens :</strong> consultez la localisation des annonces qui disposent de coordonnées.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Double espace dédié :</strong> Comptes propriétaires et clients avec tableaux de bord adaptés.
                  </span>
                </div>
              </div>
            </div>

          </section>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 2 : À PROPOS DU DÉVELOPPEUR (MOKTAR ADEOTI)
          ═══════════════════════════════════════════════════════════ */}
          <section className="bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl shadow-sm border border-emerald-150 border-slate-200/80 p-6 sm:p-10 relative overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold">
                <Code2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Le concepteur du projet
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  À propos du Développeur
                </h2>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Carte profil / identité */}
              <div className="w-full lg:w-80 shrink-0 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs text-center flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 p-1 shadow-md mb-4">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl font-bold tracking-wider">
                    MA
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900">
                  Moktar ADEOTI
                </h3>
                <p className="text-emerald-700 font-medium text-sm mt-0.5 flex items-center justify-center gap-1">
                  <Smartphone className="w-4 h-4" />
                  Développeur Flutter
                </p>

                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mt-2 bg-slate-100 px-3 py-1 rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  <span>Abomey-Calavi, Bénin 🇧🇯</span>
                </div>

                <div className="w-full border-t border-slate-100 my-4"></div>

                <div className="w-full flex flex-wrap gap-1.5 justify-center">
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Flutter & Dart
                  </span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Mobile UI/UX
                  </span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    React & Web
                  </span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Node.js & Express
                  </span>
                </div>

                <a
                  href="https://wa.me/2290156085468?text=Bonjour%20Moktar%2C%20je%20vous%20contacte%20depuis%20la%20plateforme%20IMOVA."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp : 01 56 08 54 68
                </a>
              </div>

              {/* Biographie, vision et philosophie */}
              <div className="flex-1 space-y-5">
                <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                  <p>
                    <strong>Moktar ADEOTI</strong> conçoit IMOVA depuis Abomey-Calavi, au Bénin. Le projet met l'accent sur la recherche de biens, leur présentation et la prise de contact entre les personnes intéressées et les propriétaires.
                  </p>
                  <p>
                    Le site comprend notamment une recherche par commune, une carte, des demandes de visite et une messagerie. Les informations d'une annonce et les modalités de contact sont à vérifier directement auprès de son propriétaire.
                  </p>
                </div>

                {/* Valeurs du développeur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
                    <Heart className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Empathie utilisateur & design inclusif</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
                    <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Performances optimisées pour smartphones</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-4">
                  <a
                    href="https://wa.me/2290156085468?text=Bonjour%20Moktar%2C%20je%20vous%20contacte%20depuis%20la%20plateforme%20IMOVA."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Discuter sur WhatsApp (01 56 08 54 68)
                  </a>
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-colors shadow-sm"
                  >
                    <Mail className="w-4 h-4" />
                    Formulaire de contact
                  </Link>
                  <Link
                    to="/biens"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-medium text-sm transition-colors"
                  >
                    Découvrir les annonces
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
