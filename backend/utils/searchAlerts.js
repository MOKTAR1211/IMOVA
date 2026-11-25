const { sendSearchAlertEmail } = require("./email");
const { createAndEmitNotification } = require("../routes/notifications");

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesAlert(alert, property) {
  const city = normalize(alert.city);
  const propertyCity = normalize(property.ville);
  const type = normalize(alert.type);
  const propertyType = normalize(property.type);
  const price = Number(property.prix);
  const bedrooms = Number(property.chambres) || 0;

  if (city && !propertyCity.includes(city)) return false;
  if (
    type
    && !(type === "parcelle" || type === "terrain"
      ? propertyType.includes("terrain") || propertyType.includes("parcelle")
      : propertyType === type)
  ) return false;
  if (alert.min_price != null && price < Number(alert.min_price)) return false;
  if (alert.max_price != null && price > Number(alert.max_price)) return false;
  if (alert.min_bedrooms != null && bedrooms < Number(alert.min_bedrooms)) return false;

  return true;
}

async function notifyMatchingSearchAlerts(pool, io, property) {
  const alertsResult = await pool.query(
    `SELECT sa.id, sa.user_id, sa.city, sa.type, sa.min_price, sa.max_price,
            sa.min_bedrooms, u.email
     FROM search_alerts sa
     JOIN users u ON u.id = sa.user_id
     WHERE sa.is_active = TRUE AND u.is_active = TRUE AND u.role = 'client'`
  );

  const matchingAlerts = alertsResult.rows.filter((alert) => matchesAlert(alert, property));
  const notifiedUsers = new Set();

  for (const alert of matchingAlerts) {
    if (notifiedUsers.has(String(alert.user_id))) continue;
    notifiedUsers.add(String(alert.user_id));

    const location = [property.ville, property.quartier].filter(Boolean).join(", ");
    const message = `${property.titre} est disponible à ${location} pour ${Number(property.prix).toLocaleString("fr-FR")} FCFA.`;
    try {
      await createAndEmitNotification(io, {
        userId: alert.user_id,
        title: "Nouveau bien pour votre recherche",
        message,
        link: `/bien/${property.id}`,
      });
    } catch (error) {
      console.warn(`Notification d'alerte non créée (utilisateur ${alert.user_id}):`, error.message);
      continue;
    }

    try {
      await sendSearchAlertEmail(alert.email, property);
    } catch (error) {
      console.warn(`E-mail d'alerte de recherche non envoyé (utilisateur ${alert.user_id}):`, error.message);
    }
  }

  return notifiedUsers.size;
}

module.exports = { matchesAlert, notifyMatchingSearchAlerts };
