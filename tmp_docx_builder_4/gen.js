const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');

(async () => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: 'IMMO229', bold: true, size: 38, color: '1F4E79' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Documentation fonctionnelle et technique', bold: true, size: 26, color: '2F5D8C' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Projet immobilier • Paiements • Messagerie • Administration', italics: true, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Version finale • 09/11/2026', size: 18 })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: 'Table des matières', bold: true, size: 24, color: '1F4E79' })] }),
        new Paragraph({ children: [new TextRun({ text: '1. Présentation du projet' })] }),
        new Paragraph({ children: [new TextRun({ text: '2. Architecture technique' })] }),
        new Paragraph({ children: [new TextRun({ text: '3. Structure du dépôt' })] }),
        new Paragraph({ children: [new TextRun({ text: '4. Rôles et permissions' })] }),
        new Paragraph({ children: [new TextRun({ text: '5. Fonctionnalités métier' })] }),
        new Paragraph({ children: [new TextRun({ text: '6. Sécurité et authentification' })] }),
        new Paragraph({ children: [new TextRun({ text: '7. Paiements MTN MoMo' })] }),
        new Paragraph({ children: [new TextRun({ text: '8. Messagerie temps réel' })] }),
        new Paragraph({ children: [new TextRun({ text: '9. Déploiement et maintenance' })] }),
        new Paragraph({ children: [new TextRun({ text: '10. Recommandations de production' })] }),
        new Paragraph({ children: [new TextRun({ text: '11. Conclusion' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '1. Présentation du projet', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'IMMO229 est une plateforme immobilière pensée pour la publication de biens, la recherche d’annonces, la gestion des comptes et la sécurisation des échanges entre clients et propriétaires.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le système couvre les besoins d’un marché local en intégrant la logique de paiement, la vérification côté serveur, la messagerie temps réel et le rôle d’administration.' })] }),
        new Paragraph({ children: [new TextRun({ text: '2. Architecture technique', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Frontend : React 19, Vite, React Router, Leaflet, Recharts, Tailwind CSS, Socket.IO client.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Backend : Node.js, Express 5, PostgreSQL, JWT, Socket.IO, Bcrypt, Nodemailer, pg-mem (fallback en développement), Cloudinary.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le point d’entrée principal demeure backend/server.js et le schéma de données est défini dans backend/schema.sql.' })] }),
        new Paragraph({ children: [new TextRun({ text: '3. Structure du dépôt', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: '- src/ : interface utilisateur et routeur principal' })] }),
        new Paragraph({ children: [new TextRun({ text: '- backend/ : API REST, middlewares, base de données, sécurité' })] }),
        new Paragraph({ children: [new TextRun({ text: '- deploy/ : scripts de déploiement et configuration serveur' })] }),
        new Paragraph({ children: [new TextRun({ text: '- nginx/ : configuration de proxy et TLS' })] }),
        new Paragraph({ children: [new TextRun({ text: '- docker-compose.yml : environnement local de démonstration' })] }),
        new Paragraph({ children: [new TextRun({ text: '- README.md : documentation technique et procédure d’installation' })] }),
        new Paragraph({ children: [new TextRun({ text: '4. Rôles et permissions', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Client : recherche de biens, favoris, visites, paiement d’accès à la messagerie.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Propriétaire : ajout et gestion de biens, publication, suivi des interactions.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Admin : modération, gestion des comptes, supervision des paiements et signalements.' })] }),
        new Paragraph({ children: [new TextRun({ text: '5. Fonctionnalités métier', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Les principales capacités du produit sont la publication d’annonces, la recherche avancée, la cartographie des biens, la gestion de favoris, les visites, les notifications et la messagerie entre acheteurs et vendeurs.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le parcours métier clé consiste à publier un bien, valider son paiement, rendre l’annonce visible, puis permettre à un client d’interagir avec le propriétaire dans un cadre sécurisé.' })] }),
        new Paragraph({ children: [new TextRun({ text: '6. Sécurité et authentification', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le backend sécurise les routes sensibles avec des JWT, contrôle des comptes suspendus et validation des actions admin. Les entêtes HTTP et le CORS sont également configurés pour réduire les risques de vulnérabilité web.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Dans le middleware auth.js, l’API vérifie le token Bearer, refuse les comptes suspendus et retourne des erreurs explicites selon le contexte.' })] }),
        new Paragraph({ children: [new TextRun({ text: '7. Paiements MTN MoMo', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le système gère deux flux importants : le paiement de publication (1000 FCFA) et le paiement d’accès à la messagerie (500 FCFA par bien).' })] }),
        new Paragraph({ children: [new TextRun({ text: 'La validation de ces paiements doit être faite côté serveur. Les identifiants MTN ne sont pas exposés au frontend et la procédure de paiement reste contrôlée par le backend.' })] }),
        new Paragraph({ children: [new TextRun({ text: '8. Messagerie temps réel', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'La messagerie est pilotée par Socket.IO. Chaque utilisateur est authentifié, les salles de conversation sont filtrées selon les droits, et seuls les participants autorisés peuvent lire ou écrire.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'L’accessibilité à la conversation est conditionnée au paiement vérifié, ce qui protège le modèle économique du produit.' })] }),
        new Paragraph({ children: [new TextRun({ text: '9. Déploiement et maintenance', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le projet est compatible avec le développement local, Docker et un déploiement sur VPS Linux. PM2 et Nginx sont recommandés pour le backend et le frontend, avec TLS et reverse proxy pour Socket.IO.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Les variables d’environnement, la base PostgreSQL, les dossiers d’upload et les secrets doivent être protégés et sauvegardés régulièrement.' })] }),
        new Paragraph({ children: [new TextRun({ text: '10. Recommandations de production', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: '- Utiliser PostgreSQL dédié et sécurisé' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Ne jamais committer les secrets ou les clés MTN' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Forcer HTTPS et sécuriser les WebSocket via reverse proxy' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Sauvegarder la base et les uploads séparément' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Vérifier les flux MTN en environnement réel avant mise en ligne' })] }),
        new Paragraph({ children: [new TextRun({ text: '11. Conclusion', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'IMMO229 apporte une réponse cohérente à la gestion immobilière moderne : publication, paiement, accès sécurisé, communication instantanée et supervision administrative. C’est un projet bien structuré pour un usage réel et évolutif.' })] })
      ]
    }]
  });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('C:/Users/dell/Desktop/Immo229/Documentation_IMMO229_PROFESSIONNELLE.docx', buffer);
  console.log('Professional document generated');
})();
