const LOGO_ASSETS = {
  horizontal: "/imova-logo-horizontal.svg",
  white: "/imova-logo-white.svg",
  navy: "/imova-logo-navy.svg",
  primary: "/imova-logo.svg",
  symbol: "/imova-symbol.svg",
};

export default function BrandLogo({ variant = "horizontal", className = "" }) {
  const asset = LOGO_ASSETS[variant] || LOGO_ASSETS.horizontal;
  const alt = variant === "symbol"
    ? "Symbole IMOVA"
    : "IMOVA — L'immobilier autrement.";

  return <img className={className} src={asset} alt={alt} />;
}
