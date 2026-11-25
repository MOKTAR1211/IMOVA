import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Camera, Check, House, ImagePlus, MapPin, ShieldCheck, Wallet } from "lucide-react";
import PropertyLocationPicker from "../components/PropertyLocationPicker";
import { API_URL } from "../config/api";
import { BENIN_COMMUNES } from "../data/beninCommunes";
import BrandLogo from "../components/BrandLogo";
import "./AddProperty.css";

function AddProperty() {

  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const [form, setForm] = useState({
    titre: "",
    description: "",
    prix: "",
    ville: "",
    quartier: "",
    type: "Appartement",
    transaction_type: "",
    chambres: "",
    douches: "",
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingPaymentPropertyId, setPendingPaymentPropertyId] = useState(null);
  const [mtnPhoneNumber, setMtnPhoneNumber] = useState("");
  const fileInputRef = useRef(null);
  const previewUrlsRef = useRef([]);

  useEffect(() => {
    return () => previewUrlsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length > 8) {
      setMessage("Vous pouvez sélectionner maximum 8 photos.");
      e.target.value = "";
      return;
    }

    setImages(files);
    previewUrlsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    const previews = files.map((file) => URL.createObjectURL(file));
    previewUrlsRef.current = previews;
    setImagePreviews(previews);
    setMessage("");
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    previewUrlsRef.current = previewUrlsRef.current.filter((_, imageIndex) => imageIndex !== index);
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
    setImagePreviews((current) => current.filter((_, imageIndex) => imageIndex !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startPublicationPayment = async (propertyId) => {
    setSubmitting(true);
    setMessage("Préparation du paiement de 1 000 FCFA...");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/property-payments/properties/${propertyId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber: mtnPhoneNumber }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible de préparer le paiement.");
      }

      if (data.paid) {
        navigate("/my-properties");
        return;
      }

      navigate(`/publication/paiement?propertyId=${encodeURIComponent(propertyId)}`);
    } catch (error) {
      setPendingPaymentPropertyId(propertyId);
      setMessage(`${error.message} Votre annonce est enregistrée en attente de paiement.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      setMessage("Vous devez être connecté.");
      return;
    }

    if (images.length === 0) {
      setMessage("Veuillez sélectionner au moins une photo.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      // 1. Préparer les images
      const imageFormData = new FormData();
      images.forEach((img) => {
        imageFormData.append("images", img);
      });
      const token = localStorage.getItem("token");

      // 2. Envoyer les images
      const uploadResponse = await fetch(
                  `${API_URL}/properties/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: imageFormData,
        }
      );

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        setMessage(uploadData.message);
        return;
      }

      // 3. Créer le bien
      const response = await fetch(
                  `${API_URL}/properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            prix: Number(form.prix),
            chambres: Number(form.chambres),
            douches: Number(form.douches),
            latitude: latitude !== "" && latitude != null ? Number(latitude) : null,
            longitude: longitude !== "" && longitude != null ? Number(longitude) : null,
            image_url: uploadData.images[0],
            images: uploadData.images,
            proprietaire_id: user.id
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      // 4. Enregistrer toutes les photos associées
      for (const imageUrl of uploadData.images) {
        const imageResponse = await fetch(
          `${API_URL}/properties/images`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              property_id: data.property.id,
              image_url: imageUrl,
            }),
          }
        );

        if (!imageResponse.ok) {
          throw new Error("L'enregistrement des photos a échoué.");
        }
      }

      setPendingPaymentPropertyId(data.property.id);
      await startPublicationPayment(data.property.id);

    } catch (error) {
      console.error(error);
      setMessage(error.message || "Erreur de connexion au serveur.");
    } finally {
      setSubmitting(false);
    }
  };

  const formattedPrice = form.prix
    ? `${Number(form.prix).toLocaleString("fr-FR")} FCFA`
    : "Prix à définir";

  return (
    <div className="add-property-shell">
      <nav className="add-property-nav">
        <Link to="/" className="add-property-brand" aria-label="IMOVA, accueil">
          <BrandLogo className="add-property-brand__logo" />
        </Link>
        <Link to="/property-dashboard" className="add-property-back">
          <ArrowLeft size={17} />
          <span>Tableau de bord</span>
        </Link>
      </nav>

      <main className="add-property-page">
        <header className="add-property-heading">
          <div className="add-property-eyebrow"><span /> ESPACE PROPRIÉTAIRE</div>
          <h1>Publiez votre bien immobilier</h1>
          <p>Présentez votre bien aux personnes qui recherchent leur prochain logement.</p>
          <div className="add-property-steps" aria-label="Étapes de publication">
            <span className="is-current"><b>1</b> Informations</span>
            <i />
            <span><b>2</b> Photos et localisation</span>
            <i />
            <span><b>3</b> Publication</span>
          </div>
        </header>

        <div className="add-property-layout">
          <form id="property-create-form" className="add-property-form" onSubmit={handleSubmit}>
            <section className="form-section">
              <div className="form-section-heading">
                <span className="form-section-icon"><House size={19} /></span>
                <div>
                  <h2>Les informations du bien</h2>
                  <p>Commencez par les éléments essentiels de votre annonce.</p>
                </div>
              </div>

              <div className="add-property-fields">
                <label className="field-full">
                  <span>Titre de l’annonce <em>*</em></span>
                  <input
                    type="text"
                    name="titre"
                    placeholder="Ex. Appartement lumineux avec balcon à Calavi"
                    value={form.titre}
                    onChange={handleChange}
                    maxLength={120}
                    required
                  />
                  <small>Un titre précis aide les clients à trouver votre bien.</small>
                </label>

                <label>
                  <span>Type de bien <em>*</em></span>
                  <select name="type" value={form.type} onChange={handleChange} required>
                    <option>Appartement</option>
                    <option>Maison</option>
                    <option>Terrain</option>
                    <option>Boutique</option>
                  </select>
                </label>

                <label>
                  <span>Transaction <em>*</em></span>
                  <select name="transaction_type" value={form.transaction_type} onChange={handleChange} required>
                    <option value="">Choisir une transaction</option>
                    <option value="location">Location</option>
                    <option value="vente">Vente</option>
                  </select>
                </label>

                <label>
                  <span>Prix en FCFA <em>*</em></span>
                  <div className="price-input-wrap">
                    <input
                      type="number"
                      name="prix"
                      placeholder="Ex. 100 000"
                      value={form.prix}
                      onChange={handleChange}
                      min="1"
                      required
                    />
                    <span>FCFA</span>
                  </div>
                </label>

                <label>
                  <span>Ville / commune <em>*</em></span>
                  <input
                    type="text"
                    name="ville"
                    list="benin-communes"
                    placeholder="Ex. Abomey-Calavi"
                    value={form.ville}
                    onChange={handleChange}
                    required
                  />
                  <datalist id="benin-communes">
                    {BENIN_COMMUNES.map(({ label }) => <option value={label} key={label} />)}
                  </datalist>
                </label>

                <label>
                  <span>Quartier</span>
                  <input
                    type="text"
                    name="quartier"
                    placeholder="Ex. Tankpè"
                    value={form.quartier}
                    onChange={handleChange}
                  />
                </label>

                <label className="field-full">
                  <span>Description du bien</span>
                  <textarea
                    name="description"
                    placeholder="Décrivez les atouts du bien, son état, les équipements et les conditions de location ou de vente..."
                    value={form.description}
                    onChange={handleChange}
                    rows="5"
                    maxLength={2000}
                  />
                  <small>{form.description.length}/2 000 caractères</small>
                </label>

                <div className="form-property-features field-full">
                  <span className="form-label">Caractéristiques</span>
                  <div className="add-property-fields">
                    <label>
                      <span>Chambres</span>
                      <input type="number" name="chambres" value={form.chambres} onChange={handleChange} min="0" />
                    </label>
                    <label>
                      <span>Douches / salles d’eau</span>
                      <input type="number" name="douches" value={form.douches} onChange={handleChange} min="0" />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-heading">
                <span className="form-section-icon"><Camera size={19} /></span>
                <div>
                  <h2>Photos du bien</h2>
                  <p>Les annonces avec de belles photos attirent plus de demandes.</p>
                </div>
                <span className="section-counter">{images.length}/8</span>
              </div>

              <input
                ref={fileInputRef}
                className="property-file-input"
                id="property-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageChange}
                required={images.length === 0}
              />
              <label className="photo-dropzone" htmlFor="property-photos">
                <span className="photo-dropzone-icon"><ImagePlus size={23} /></span>
                <strong>Ajouter des photos</strong>
                <span>JPG, PNG ou WEBP · jusqu’à 8 photos</span>
                <span className="photo-select-button">Choisir des fichiers</span>
              </label>

              {imagePreviews.length > 0 && (
                <div className="image-previews" aria-label="Aperçu des photos sélectionnées">
                  {imagePreviews.map((preview, index) => (
                    <div className={`preview-item${index === 0 ? " is-cover" : ""}`} key={preview}>
                      <img src={preview} alt={`Aperçu ${index + 1}`} />
                      {index === 0 && <span className="cover-photo-label">Photo principale</span>}
                      <button
                        type="button"
                        className="remove-preview"
                        onClick={() => removeImage(index)}
                        aria-label={`Retirer la photo ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="form-section location-form-section">
              <div className="form-section-heading">
                <span className="form-section-icon"><MapPin size={19} /></span>
                <div>
                  <h2>Localisation précise</h2>
                  <p>Placez le marqueur sur la carte pour situer votre bien.</p>
                </div>
              </div>
              <PropertyLocationPicker
                latitude={latitude}
                longitude={longitude}
                onChange={({ latitude: nextLatitude, longitude: nextLongitude }) => {
                  setLatitude(nextLatitude);
                  setLongitude(nextLongitude);
                }}
              />
            </section>

            {message && (
              <p className="add-property-error" role="alert">{message}</p>
            )}

            <div className="add-property-submit-mobile">
              <button type="submit" className="publish-property-button" disabled={submitting}>
                {submitting ? "Traitement en cours..." : "Enregistrer et payer 1 000 FCFA"}
              </button>
              {pendingPaymentPropertyId && (
                <button
                  type="button"
                  className="retry-payment-button"
                  disabled={submitting}
                  onClick={() => startPublicationPayment(pendingPaymentPropertyId)}
                >
                  Réessayer le paiement
                </button>
              )}
            </div>
          </form>

          <aside className="add-property-sidebar">
            <section className="listing-preview-card">
              <div className="sidebar-card-heading">
                <span>Aperçu de l’annonce</span>
                <BadgeCheck size={18} />
              </div>
              <div className="listing-preview-image">
                {imagePreviews[0] ? (
                  <img src={imagePreviews[0]} alt="Aperçu de la photo principale" />
                ) : (
                  <div><ImagePlus size={28} /><span>Votre photo principale apparaîtra ici</span></div>
                )}
              </div>
              <div className="listing-preview-content">
                <span className="preview-type">{form.type || "Type de bien"}</span>
                <h3>{form.titre || "Titre de votre annonce"}</h3>
                <p><MapPin size={14} /> {[form.quartier, form.ville].filter(Boolean).join(", ") || "Ville, quartier"}</p>
                <strong>{formattedPrice}</strong>
              </div>
            </section>

            <section className="publication-fee-card">
              <span className="fee-icon"><Wallet size={19} /></span>
              <div>
                <h2>Frais de publication</h2>
                <p>Un paiement Mobile Money unique pour publier cette annonce automatiquement.</p>
                <strong>1 000 FCFA <small>/ annonce</small></strong>
              </div>
              <ul>
                <li><Check size={15} /> Confirmation du paiement par MTN MoMo</li>
                <li><Check size={15} /> Publication après confirmation</li>
                <li><Check size={15} /> Aucune validation administrative</li>
              </ul>
              <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="publication-mtn-phone">
                Numéro MTN Mobile Money
              </label>
              <input
                id="publication-mtn-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+229 XX XX XX XX"
                value={mtnPhoneNumber}
                onChange={(event) => setMtnPhoneNumber(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                Une demande de confirmation apparaîtra sur ce numéro. Ne communiquez jamais votre code PIN.
              </p>
            </section>

            <button type="submit" form="property-create-form" className="publish-property-button" disabled={submitting}>
              {submitting ? "Traitement en cours..." : "Enregistrer et payer"}
            </button>
            {pendingPaymentPropertyId && (
              <button
                type="button"
                className="retry-payment-button"
                disabled={submitting}
                onClick={() => startPublicationPayment(pendingPaymentPropertyId)}
              >
                Réessayer le paiement
              </button>
            )}
            <p className="payment-security-note"><ShieldCheck size={15} /> Vos informations sont protégées.</p>
            <p className="add-property-privacy">En publiant, vous confirmez que les informations et photos fournies sont exactes.</p>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default AddProperty;
