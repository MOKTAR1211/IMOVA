import { useEffect } from "react";

/**
 * Hook pour gérer dynamiquement le référencement naturel (SEO) et les données structurées Schema.org
 */
export default function useSEO({
  title,
  description,
  image,
  url,
  noindex = false,
  structuredData = null,
} = {}) {
  useEffect(() => {
    // 1. Titre de page
    if (title) {
      document.title = `${title} — IMOVA`;
    }

    // 2. Meta description
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", description);
    }

    // 3. Open Graph : Titre, Description, Image
    if (title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", `${title} — IMOVA`);
    }

    if (description) {
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", description);
    }

    if (image) {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) ogImg.setAttribute("content", image);
    }

    // 4. Directive Robots (noindex pour les pages privées)
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (noindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement("meta");
        robotsMeta.setAttribute("name", "robots");
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.setAttribute("content", "noindex, nofollow");
    } else if (robotsMeta) {
      robotsMeta.remove();
    }

    // 5. Données structurées JSON-LD (Schema.org)
    let jsonLdScript = document.getElementById("dynamic-schema-org");
    if (structuredData) {
      if (!jsonLdScript) {
        jsonLdScript = document.createElement("script");
        jsonLdScript.id = "dynamic-schema-org";
        jsonLdScript.type = "application/ld+json";
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = JSON.stringify(structuredData);
    } else if (jsonLdScript) {
      jsonLdScript.remove();
    }

    return () => {
      // Nettoyage lors du démontage du composant
      const cleanScript = document.getElementById("dynamic-schema-org");
      if (cleanScript) cleanScript.remove();
    };
  }, [title, description, image, url, noindex, structuredData]);
}
