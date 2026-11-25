import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Compass,
  Heart,
  Home,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Shield,
  X,
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import BrandLogo from './BrandLogo';
import './Navbar.css';

const navigationLinks = [
  { label: 'Accueil', to: '/', icon: Home, matches: (path) => path === '/' },
  { label: 'Explorer les biens', to: '/biens', icon: Building2, matches: (path) => ['/biens', '/properties'].includes(path) || path.startsWith('/bien/') || path.startsWith('/properties/') },
  { label: 'Carte', to: '/carte', icon: MapPin, matches: (path) => ['/carte', '/property-map'].includes(path) },
  { label: 'À proximité', to: '/proximite', icon: Compass, matches: (path) => ['/proximite', '/nearby-properties'].includes(path) },
  { label: 'À propos', to: '/a-propos', icon: Info, matches: (path) => path === '/a-propos' },
  { label: 'Contact', to: '/contact', icon: MessageCircle, matches: (path) => path === '/contact' },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const mobileCloseRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  let user = null;
  if (typeof window !== 'undefined') {
    try {
      user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      user = null;
    }
  }
  const isClient = user?.role === 'client';
  const isOwner = user?.role === 'proprietaire';
  const canUseMessages = isClient || isOwner;
  const isMessagesPage = location.pathname.startsWith('/messages');
  const dashboardPath = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'proprietaire'
      ? '/property-dashboard'
      : '/dashboard';

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const toggleElement = mobileToggleRef.current;
    document.body.style.overflow = 'hidden';
    mobileCloseRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !mobileMenuRef.current) return;
      const focusableElements = mobileMenuRef.current.querySelectorAll('a[href], button:not([disabled])');
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      toggleElement?.focus();
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setMobileMenuOpen(false);
    navigate('/');
  };

  const getLinkClass = (link) => (
    `immo-navbar__link${link.matches(location.pathname) ? ' is-active' : ''}`
  );

  const getMobileLinkClass = (link) => (
    `immo-navbar__mobile-link${link.matches(location.pathname) ? ' is-active' : ''}`
  );

  return (
    <header className="immo-navbar">
      <div className="immo-navbar__inner">
        <Link
          to="/"
          className="immo-navbar__brand"
          aria-label="IMOVA, accueil"
          onClick={() => setMobileMenuOpen(false)}
        >
          <BrandLogo className="immo-navbar__logo" />
        </Link>

        <nav className="immo-navbar__desktop-nav" aria-label="Navigation principale">
          {navigationLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={getLinkClass(link)}
                aria-current={link.matches(location.pathname) ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="immo-navbar__desktop-actions">
          {token && <NotificationCenter />}
          {token ? (
            <>
              {isClient && (
                <>
                  <Link to="/favoris" className="immo-navbar__icon-action" title="Mes favoris" aria-label="Mes favoris">
                    <Heart aria-hidden="true" />
                  </Link>
                  <Link to="/mes-visites" className="immo-navbar__icon-action" title="Mes visites programmées" aria-label="Mes visites programmées">
                    <Calendar aria-hidden="true" />
                  </Link>
                </>
              )}
              {canUseMessages && (
                <Link
                  to="/messages"
                  className={`immo-navbar__icon-action${isMessagesPage ? ' is-active' : ''}`}
                  title="Mes messages"
                  aria-label="Mes messages"
                >
                  <MessageCircle aria-hidden="true" />
                </Link>
              )}
              <Link to={dashboardPath} className="immo-navbar__dashboard">
                <LayoutDashboard aria-hidden="true" />
                <span>{user?.nom ? user.nom.split(' ')[0] : 'Mon compte'}</span>
              </Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="immo-navbar__icon-action immo-navbar__admin" title="Administration" aria-label="Administration">
                  <Shield aria-hidden="true" />
                </Link>
              )}
              {isOwner && (
                <Link to="/ajouter-bien" className="immo-navbar__publish">
                  <Plus aria-hidden="true" />
                  <span>Publier</span>
                </Link>
              )}
              <button type="button" onClick={handleLogout} className="immo-navbar__logout" title="Se déconnecter" aria-label="Se déconnecter">
                <LogOut aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link to="/connexion" className="immo-navbar__login">
                <LogIn aria-hidden="true" />
                <span>Connexion</span>
              </Link>
              <Link to="/inscription" className="immo-navbar__publish">
                <Plus aria-hidden="true" />
                <span>Publier une annonce</span>
              </Link>
            </>
          )}
        </div>

        <div className="immo-navbar__mobile-actions">
          {token && <NotificationCenter />}
          <button
            ref={mobileToggleRef}
            type="button"
            className={`immo-navbar__menu-toggle${mobileMenuOpen ? ' is-open' : ''}`}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="immo229-mobile-menu"
          >
            {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {createPortal(
        <div
          id="immo229-mobile-menu"
          className={`immo-navbar__mobile-menu${mobileMenuOpen ? ' is-open' : ''}`}
          aria-hidden={!mobileMenuOpen}
          inert={!mobileMenuOpen}
        >
        <button
          type="button"
          className="immo-navbar__mobile-backdrop"
          aria-label="Fermer le menu"
          tabIndex={-1}
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside
          ref={mobileMenuRef}
          className="immo-navbar__mobile-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="immo229-mobile-menu-title"
        >
          <div className="immo-navbar__mobile-panel-header">
            <div className="immo-navbar__mobile-brand">
              <span id="immo229-mobile-menu-title" className="sr-only">Navigation IMOVA</span>
              <BrandLogo variant="white" className="immo-navbar__mobile-brand-logo" />
            </div>
            <button
              ref={mobileCloseRef}
              type="button"
              className="immo-navbar__mobile-close"
              aria-label="Fermer le menu"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="immo-navbar__mobile-content">
            <nav className="immo-navbar__mobile-nav" aria-label="Navigation principale">
              {navigationLinks.map((link, index) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`${getMobileLinkClass(link)}${index === 4 ? ' is-group-start' : ''}`}
                    aria-current={link.matches(location.pathname) ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="immo-navbar__mobile-account">
              {token ? (
                <>
                  <Link to={dashboardPath} className="immo-navbar__mobile-dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <LayoutDashboard aria-hidden="true" />
                    <span>Mon espace {user?.nom ? `— ${user.nom}` : ''}</span>
                  </Link>
                  {canUseMessages && (
                    <Link to="/messages" className={`immo-navbar__mobile-utility${isMessagesPage ? ' is-active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                      <MessageCircle aria-hidden="true" />
                      <span>Mes messages</span>
                    </Link>
                  )}
                  {isClient && (
                    <div className="immo-navbar__mobile-shortcuts">
                      <Link to="/favoris" className="immo-navbar__mobile-utility" onClick={() => setMobileMenuOpen(false)}>
                        <Heart aria-hidden="true" /><span>Favoris</span>
                      </Link>
                      <Link to="/mes-visites" className="immo-navbar__mobile-utility" onClick={() => setMobileMenuOpen(false)}>
                        <Calendar aria-hidden="true" /><span>Mes visites</span>
                      </Link>
                    </div>
                  )}
                  {user?.role === 'admin' && (
                    <Link to="/admin" className="immo-navbar__mobile-utility" onClick={() => setMobileMenuOpen(false)}>
                      <Shield aria-hidden="true" /><span>Administration</span>
                    </Link>
                  )}
                  {isOwner && (
                    <Link to="/ajouter-bien" className="immo-navbar__mobile-publish" onClick={() => setMobileMenuOpen(false)}>
                      <Plus aria-hidden="true" /><span>Publier une annonce</span>
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout} className="immo-navbar__mobile-logout">
                    <LogOut aria-hidden="true" /><span>Se déconnecter</span>
                  </button>
                </>
              ) : (
                <div className="immo-navbar__mobile-actions-grid">
                  <Link to="/connexion" className="immo-navbar__mobile-login" onClick={() => setMobileMenuOpen(false)}>
                    <LogIn aria-hidden="true" /><span>Connexion</span>
                  </Link>
                  <Link to="/inscription" className="immo-navbar__mobile-publish" onClick={() => setMobileMenuOpen(false)}>
                    <Plus aria-hidden="true" /><span>Publier une annonce</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="immo-navbar__mobile-signature" aria-hidden="true">
            <span>IMOVA</span>
            <span>L'immobilier autrement.</span>
          </div>
        </aside>
        </div>,
        document.body,
      )}
    </header>
  );
}
