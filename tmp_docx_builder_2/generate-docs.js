const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle, WidthType, PageBreak } = require('docx');

function addTitle(doc, title) {
  doc.addSection({
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 },
        children: [new TextRun({ text: title, bold: true, size: 30 })]
      })
    ]
  });
}

function makeProDoc() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: 'IMMO229', bold: true, size: 38, color: '1F4E79' })]
        }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Documentation technique et fonctionnelle', bold: true, size: 26, color: '2F5D8C' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Version professionnelle', italics: true, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '09/11/2026', size: 18 })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: 'Sommaire', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: '1. Vue d’ensemble' })] }),
        new Paragraph({ children: [new TextRun({ text: '2. Architecture technique' })] }),
        new Paragraph({ children: [new TextRun({ text: '3. Structure du projet' })] }),
        new Paragraph({ children: [new TextRun({ text: '4. Rôles et permissions' })] }),
        new Paragraph({ children: [new TextRun({ text: '5. Fonctionnalités métier' })] }),
        new Paragraph({ children: [new TextRun({ text: '6. Sécurité et authentification' })] }),
        new Paragraph({ children: [new TextRun({ text: '7. Paiements et MTN MoMo' })] }),
        new Paragraph({ children: [new TextRun({ text: '8. Messagerie temps réel' })] }),
        new Paragraph({ children: [new TextRun({ text: '9. Déploiement, configuration et maintenance' })] }),
        new Paragraph({ children: [new TextRun({ text: '10. Recommandations de production' })] }),
        new Paragraph({ children: [new TextRun({ text: '11. Conclusion' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '1. Vue d’ensemble', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'IMMO229 est une plateforme immobilière complète destinée aux propriétaires, clients et administrateurs. Elle permet de publier des biens immobiliers, de rechercher des annonces, d’effectuer des paiements, de négocier et de gérer la relation client-propriétaire via une messagerie sécurisée.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le projet s’appuie sur un frontend React/Vite et un backend Express qui expose une API REST sécurisée et un service WebSocket pour la messagerie temps réel.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '2. Architecture technique', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Frontend: React 19, Vite, React Router, Tailwind CSS, Leaflet, Recharts, Socket.IO client.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Backend: Node.js, Express 5, PostgreSQL, JWT, Socket.IO, Bcrypt, Nodemailer, Cloudinary, pg-mem (fallback localhost).'} )] }),
        new Paragraph({ children: [new TextRun({ text: 'Le point d’entrée principal du backend est backend/server.js. Le schéma de données principal se trouve dans backend/schema.sql.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '3. Structure du projet', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'src/: interface utilisateur' })] }),
        new Paragraph({ children: [new TextRun({ text: 'backend/: API REST, middlewares, configuration et base de données' })] }),
        new Paragraph({ children: [new TextRun({ text: 'deploy/: scripts et fichiers de déploiement' })] }),
        new Paragraph({ children: [new TextRun({ text: 'nginx/: configuration réseau et reverse proxy' })] }),
        new Paragraph({ children: [new TextRun({ text: 'docker-compose.yml: environnement local de démonstration' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '4. Rôles et permissions', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Client: recherche, favori, réservation, messagerie, paiement d’accès.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Propriétaire: publication, gestion de biens, paiement de publication, suivi des demandes.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Admin: supervision, modération, réglage des paiements et gestion des comptes.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '5. Fonctionnalités métier', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le système permet l’inscription des utilisateurs, la connexion sécurisée, la publication de biens immobiliers, la recherche avancée, les favoris, les visites, les signalements, le suivi des paiements et la messagerie entre parties.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Les annonces peuvent être filtrées par ville, quartier, type, prix et autres critères. Les propriétaires peuvent gérer leurs biens depuis un tableau de bord dédié.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '6. Sécurité et authentification', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le backend oblige une authentification via JWT pour les routes sensibles. Les comptes suspendus ne peuvent ni se connecter ni accéder aux ressources. Les headers HTTP et la configuration CORS sont contrôlés pour limiter les risques.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Les routes d’API sont protégées par un middleware d’authentification. Un second middleware vérifie les droits d’administration.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '7. Paiements et MTN MoMo', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le projet gère deux flux de paiement: le paiement de publication d’une annonce (1000 FCFA) et le paiement d’accès à une conversation (500 FCFA par bien).' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le backend valide le statut du paiement côté serveur et n’active la publication ou l’accès qu’après confirmation. Les identifiants MTN sont conservés côté serveur.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '8. Messagerie temps réel', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le backend utilise Socket.IO pour gérer l’authentification, la présence en ligne, les salles de conversation et l’indicateur de frappe.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Un client ne peut parfois rejoindre une conversation que s’il a payé son accès. Les images sont stockées hors du dossier public pour protéger la confidentialité.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '9. Déploiement, configuration et maintenance', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le projet supporte un environnement local, Docker et un déploiement VPS Ubuntu/Debian. PM2 et Nginx sont recommandés pour le backend et le frontend. Les variables d’environnement doivent être sécurisées et hors du dépôt.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'La base PostgreSQL, les uploads et les secrets doivent faire l’objet d’une politique de sauvegarde et de protection explicite.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '10. Recommandations de production', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: '- Utiliser PostgreSQL dédié et protégé' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Ne pas committer les secrets' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Forcer HTTPS et reverse proxy WebSocket' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Sauvegarder régulièrement la base et les fichiers uploadés' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Tester les flux de paiement en environnement réel avant production' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '11. Conclusion', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'IMMO229 est un projet immobilier robuste, orienté marché réel et sécurisation. Il couvre les cas d’usage clés d’une plateforme de mise en relation immobilière avec un fort besoin de fiabilité, de contrôle d’accès et de conformité de paiement.' })] })
      ]
    }]
  });
  return doc;
}

function makeUserDoc() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 350, after: 200 }, children: [new TextRun({ text: 'Documentation utilisateur IMMO229', bold: true, size: 32, color: '1F4E79' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Guide fonctionnel pour clients, propriétaires et administrateurs', size: 22 })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '1. Objectif', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'IMMO229 permet de rechercher un bien immobilier, de contacter le propriétaire, de payer des frais de publication ou d’accès à la messagerie et de gérer les annonces dans un espace sécurisé.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '2. Accès au système', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Un utilisateur peut s’inscrire depuis la page d’inscription et se connecter depuis la page de connexion. Selon son rôle, il accède à des écrans spécifiques: client, propriétaire ou administration.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '3. Pour un client', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le client peut consulter les biens disponibles, filtrer selon la ville, le prix, le type de bien et la localisation. Il peut enregistrer des propriétés en favoris et demander une visite.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Pour discuter avec le propriétaire, il peut ouvrir une conversation. S’il ne l’a pas encore payée, l’accès est conditionné et la clé de messagerie ne lui est accordée qu’après validation du paiement.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '4. Pour un propriétaire', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Le propriétaire peut ajouter un bien, renseigner les caractéristiques, télécharger des photos, fixer le prix et choisir le statut de publication. Une annonce reste en attente tant que le paiement de publication n’a pas été validé.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Il peut ensuite gérer ses propriétés, suivre les visites, consulter les messages clients et sécuriser ses échanges.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '5. Pour l’administrateur', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'L’administrateur peut suivre les comptes, les paiements, les signalements, les annonces et les éventuels problèmes de sécurité. Il vérifie les demandes et applique les décisions de modération nécessaires.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '6. Processus métier principal', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Étape 1: un propriétaire publie un bien.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Étape 2: le système vérifie le paiement de publication avant activation.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Étape 3: le client consulte les annonces, filtre les résultats et décide d’interagir.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Étape 4: le client peut payer l’accès à une conversation selon le bien.' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Étape 5: la messagerie devient active et les échanges ont lieu en temps réel.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '7. Sécurité et confidentialité', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Les comptes suspendus ne peuvent plus accéder à l’application. Les images et pièces jointes ne sont pas exposées publiquement. Les accès aux messages sont vérifiés selon le rôle et le paiement effectif.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: '8. Règles de conformité et bonnes pratiques', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: '- Ne jamais exposer les secrets ou clés MTN dans le code frontend.' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Renseigner correctement les données de connexion et les paramètres SMTP.' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Utiliser HTTPS et des backends sécurisés en production.' })] }),
        new Paragraph({ children: [new TextRun({ text: '- Sauvegarder la base et les fichiers uploadés régulièrement.' })] }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ children: [new TextRun({ text: 'Conclusion', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Cette documentation fonctionnelle permet de comprendre le rôle de chaque acteur dans IMMO229 et les étapes principales du parcours utilisateur. Le système est conçu pour être simple à utiliser, sécurisé et adapté à une activité immobilière locale et professionnelle.' })] })
      ]
    }]
  });
  return doc;
}

(async () => {
  const proBuffer = await Packer.toBuffer(makeProDoc());
  const userBuffer = await Packer.toBuffer(makeUserDoc());
  fs.writeFileSync('C:/Users/dell/Desktop/Immo229/Documentation_IMMO229_PRO.docx', proBuffer);
  fs.writeFileSync('C:/Users/dell/Desktop/Immo229/Documentation_IMMO229_UTILISATEUR.docx', userBuffer);
  console.log('Both DOCX files created successfully');
})();
