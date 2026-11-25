const prisma = require('../db');

/**
 * Crée une notification en base de données.
 *
 * @param {number} userId      - L'utilisateur destinataire
 * @param {string} title       - Titre court de la notification
 * @param {string} message     - Message descriptif
 * @param {string} type        - Type : 'visit' | 'property' | 'message' | 'general'
 * @param {number|null} relatedId - ID de l'entité concernée (visite, bien, message…)
 */
const createNotification = async (
  userId,
  title,
  message,
  type = 'general',
  relatedId = null
) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        relatedId,
      },
    });
  } catch (error) {
    // On ne bloque pas l'action principale si la notif échoue
    console.error('❌ Erreur lors de la création de la notification :', error);
  }
};

module.exports = { createNotification };
