import { Link } from 'react-router-dom';
import { MapPin, Mail, MessageCircle } from 'lucide-react';
import { BENIN_COMMUNES } from '../data/beninCommunes';
import BrandLogo from './BrandLogo';
import './Footer.css';

const FOOTER_COMMUNES = ["Cotonou", "Abomey-Calavi", "Porto-Novo", "Parakou", "Ouidah"];
const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="imova-footer">
      <div className="imova-footer__main">
        <div className="imova-footer__brand">
          <Link to="/" aria-label="IMOVA, accueil">
            <BrandLogo variant="white" className="imova-footer__logo" />
          </Link>
          <p>L'immobilier autrement.</p>
          <span>La plateforme immobilière pensée pour le Bénin.</span>
        </div>

        <div className="imova-footer__column">
          <h2>Explorer</h2>
          <ul>
            <li><Link to="/biens">Toutes les annonces</Link></li>
            <li><Link to="/carte">Carte des biens</Link></li>
            <li><Link to="/proximite">À proximité</Link></li>
            <li><Link to="/a-propos">À propos d’IMOVA</Link></li>
          </ul>
        </div>

        <div className="imova-footer__column">
          <h2>Villes</h2>
          <ul>
            {FOOTER_COMMUNES.map((label) => {
              const commune = BENIN_COMMUNES.find((item) => item.label === label);
              return (
                <li key={label}>
                  <Link to={`/biens?city=${encodeURIComponent(commune.value)}`}>
                    <MapPin size={13} aria-hidden="true" /> {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="imova-footer__column">
          <h2>Votre espace</h2>
          <ul>
            <li><Link to="/connexion">Connexion client</Link></li>
            <li><Link to="/favoris">Mes favoris</Link></li>
            <li><Link to="/ajouter-bien">Publier une annonce</Link></li>
            <li><Link to="/property-dashboard">Espace propriétaire</Link></li>
          </ul>
        </div>

        <div className="imova-footer__column imova-footer__contact">
          <h2>Contact</h2>
          <a href="https://wa.me/2290156085468" target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> +229 01 56 08 54 68
          </a>
          <a href="mailto:contact@immo229.bj">
            <Mail size={16} aria-hidden="true" /> contact@immo229.bj
          </a>
          <span><MapPin size={16} aria-hidden="true" /> Cotonou, Bénin</span>
        </div>
      </div>

      <div className="imova-footer__bottom">
        <span>© {CURRENT_YEAR} IMOVA. Tous droits réservés.</span>
        <div>
          <Link to="/a-propos">Mentions légales</Link>
          <Link to="/contact">Contact & assistance</Link>
        </div>
      </div>
    </footer>
  );
}
