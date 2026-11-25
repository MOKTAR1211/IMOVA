import useSEO from "../utils/useSEO";
import "./Contact.css";

export default function Contact() {
  useSEO({
    title: "Contactez l'équipe IMOVA",
    description: "Une question ou une suggestion ? Contactez IMOVA par e-mail ou WhatsApp.",
  });
  return (
    <main className="contact-page">
      <h1>Contactez-nous</h1>
      <p className="contact-subtitle">
        Une question, une suggestion ou un problème ? Écrivez-nous.
      </p>

      <section className="contact-grid">
        <div className="contact-info">
          <h2>Informations de contact</h2>
          <ul>
            <li>
              <span>📧</span>
              <a href="mailto:contact@immo229.bj">contact@immo229.bj</a>
            </li>
            <li>
              <span>💬</span>
              <a
                href="https://wa.me/2290156085468?text=Bonjour%20Moktar%2C%20je%20vous%20contacte%20depuis%20la%20plateforme%20IMOVA."
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp : +229 01 56 08 54 68
              </a>
            </li>
            <li>
              <span>📍</span>
              <span>Cotonou & Abomey-Calavi, Bénin</span>
            </li>
          </ul>
        </div>

        <form
          className="contact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            const subject = String(formData.get("subject") || "");
            const body = [
              `Nom : ${formData.get("name") || ""}`,
              `E-mail : ${formData.get("email") || ""}`,
              "",
              String(formData.get("message") || ""),
            ].join("\n");
            window.location.href = `mailto:contact@immo229.bj?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            alert("Votre application de messagerie va s'ouvrir. Vérifiez le message puis envoyez-le.");
            form.reset();
          }}
        >
          <h2>Envoyer un message</h2>

          <label>
            Nom complet
            <input type="text" name="name" placeholder="Jean Dupont" required />
          </label>

          <label>
            Adresse e-mail
            <input type="email" name="email" placeholder="jean@email.com" required />
          </label>

          <label>
            Objet
            <input type="text" name="subject" placeholder="Sujet de votre message" required />
          </label>

          <label>
            Message
            <textarea
              name="message"
              rows={5}
              placeholder="Votre message ici..."
              required
            />
          </label>

          <button type="submit">Envoyer le message</button>
        </form>
      </section>
    </main>
  );
}
