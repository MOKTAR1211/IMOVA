const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, WidthType } = require('docx');

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Documentation technique IMMO229', bold: true, size: 32 })]
      }),
      new Paragraph({ children: [new TextRun({ text: 'Projet: application immobilière' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Date: 09/11/2026' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '1. Vue d’ensemble', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'IMMO229 est une application web immobilière avec publication d’annonces, recherche de biens, paiements, messagerie et administration. Le projet est structuré en frontend React et backend Express avec base PostgreSQL.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '2. Architecture technique', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Frontend: React 19, Vite, React Router, Tailwind CSS, Leaflet, Recharts, Socket.IO client.' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Backend: Node.js, Express 5, JWT, PostgreSQL, Socket.IO, nodemailer, bcrypt, pg-mem (fallback sur dev), Cloudinary.' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Point d’entrée backend: backend/server.js.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '3. Structure du dépôt', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: '- src/: frontend' })] }),
      new Paragraph({ children: [new TextRun({ text: '- backend/: API' })] }),
      new Paragraph({ children: [new TextRun({ text: '- deploy/: scripts de déploiement' })] }),
      new Paragraph({ children: [new TextRun({ text: '- nginx/: configuration Nginx' })] }),
      new Paragraph({ children: [new TextRun({ text: '- docker-compose.yml: environnement local' })] }),
      new Paragraph({ children: [new TextRun({ text: '- README.md: documentation principale' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '4. Fonctionnalités principales', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: '- Authentification et gestion des rôles' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Publication d’annonces immobilières' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Recherche avancée et cartographie' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Favoris, visites et notifications' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Paiements MTN MoMo pour publication et messagerie' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Messagerie temps réel avec pièces jointes' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Administration et modération' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '5. Sécurité', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Le backend applique des headers de sécurité, contrôle CORS, protège les routes via JWT, vérifie les comptes suspendus et applique le rate limiting sur /api. Les images de conversation sont stockées hors du dossier public et les accès sont vérifiés côté serveur.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '6. Authentification', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Le middleware auth.js vérifie le JWT dans Authorization: Bearer <token>. En cas de token absent, invalide ou expiré, la réponse est 401. Si le compte est suspendu, la réponse est 403. L’admin a un middleware dédié.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '7. Base de données', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Le schéma est dans backend/schema.sql. Les objets principaux sont users, properties, property_images, property_payments, messaging_payments, notifications, search_alerts, conversations, messages et reports. En production: PostgreSQL. En développement: fallback pg-mem possible.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '8. Paiements MTN MoMo', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: '- Publication d’annonce: 1000 FCFA' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Accès à la messagerie: 500 FCFA par annonce' })] }),
      new Paragraph({ children: [new TextRun({ text: 'La validation est faite côté serveur. Les identifiants MTN restent en environnement sécurisé du serveur. Le système ne stocke pas le PIN Mobile Money et conserve uniquement les informations transactionnelles essentielles.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '9. Messagerie temps réel', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'La messagerie repose sur Socket.IO. Authenticate via JWT et accès uniquement aux conversations autorisées. Une salle de messagerie est accessible si le client a payé l’accès. Le backend gère les utilisateurs connectés, les indicateurs de frappe et la diffusion des messages.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '10. Déploiement', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Le projet est prévu pour le développement local, Docker et le déploiement VPS Ubuntu/Debian. PM2 est utilisé pour le backend, Nginx pour le frontend et le reverse proxy HTTPS/WebSocket. Le script deploy/deploy.sh automatise la mise en ligne.' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '11. Variables d’environnement', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: '- PORT, DB_*, JWT_SECRET, FRONTEND_URL, VITE_API_URL' })] }),
      new Paragraph({ children: [new TextRun({ text: '- MTN_MOMO_* variables de paiement' })] }),
      new Paragraph({ children: [new TextRun({ text: '- SMTP_* pour les e-mails' })] }),
      new Paragraph({ children: [new TextRun({ text: '- CLOUDINARY_* pour les images' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: '12. Recommandations de production', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: '- Exécuter PostgreSQL dédié' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Ne jamais committer les secrets' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Forcer HTTPS et WebSocket sécurisé' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Sauvegarder la base et les uploads' })] }),
      new Paragraph({ children: [new TextRun({ text: '- Tester les paiements réels avant mise en production' })] }),
      new Paragraph({ text: ' ' }),
      new Paragraph({ children: [new TextRun({ text: 'Conclusion', bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: 'IMMO229 est une plateforme immobilière complète qui combine publication, paiement, recherche et messagerie temps réel. Sa sécurisation des flux et la séparation des responsabilités rendent le projet cohérent pour un usage en production.' })] })
    ]
  }]
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('C:/Users/dell/Desktop/Immo229/Documentation_IMMO229.docx', buffer);
  console.log('DOCX created successfully');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
