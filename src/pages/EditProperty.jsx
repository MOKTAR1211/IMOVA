import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PropertyLocationPicker from "../components/PropertyLocationPicker";
import { API_URL } from "../config/api";

function EditProperty() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    titre: "",
    description: "",
    prix: "",
    ville: "",
    quartier: "",
    type: "Appartement",
    transaction_type: "",
    chambres: 0,
    douches: 0,
    image_url: "",
  });

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {

    const fetchProperty = async () => {

      try {
        const token = localStorage.getItem("token");

        const response = await fetch(`${API_URL}/properties/${id}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Bien introuvable.");
          return;
        }

        const property = data;

        if (!property) {
          setMessage("Bien introuvable.");
          return;
        }

        setForm({
          titre: property.titre || property.title || "",
          description: property.description || "",
          prix: property.prix || property.price || "",
          ville: property.ville || property.city || "",
          quartier: property.quartier || "",
          type: property.type || "Appartement",
          transaction_type: property.transaction_type || "",
          chambres: property.chambres || (property.rooms ? parseInt(property.rooms, 10) : 0) || 0,
          douches: property.douches || (property.bathrooms ? parseInt(property.bathrooms, 10) : 0) || 0,
          image_url: property.image_url || property.image || "",
        });

        setLatitude(property.latitude != null ? String(property.latitude) : "");
        setLongitude(property.longitude != null ? String(property.longitude) : "");

      } catch (error) {

        console.error(error);
        setMessage("Erreur serveur.");

      } finally {

        setLoading(false);

      }
    };

    fetchProperty();

  }, [id]);


  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

  };


  const handleSubmit = async (e) => {

    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `\${API_URL}/properties/${id}`,
        {
          method: "PUT",

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
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      setMessage(
        "Annonce modifiée avec succès ✅"
      );

      setTimeout(() => {
        navigate("/my-properties");
      }, 1000);

    } catch (error) {

      console.error(error);

      setMessage(
        "Impossible de contacter le serveur."
      );

    }
  };


  if (loading) {
    return (
      <div className="empty-dashboard">
        Chargement...
      </div>
    );
  }


  return (

    <div>

      <nav className="navbar">

        <Link to="/" className="logo">
          Immo<span>229</span>
        </Link>

        <Link
          to="/my-properties"
          className="back-link"
        >
          ← Retour à mes annonces
        </Link>

      </nav>


      <main className="form-page">

        <div className="form-card">

          <h1>
            Modifier l'annonce
          </h1>

          <p>
            Mettez à jour les informations du bien.
          </p>


          <form onSubmit={handleSubmit}>

            <label>
              Titre
            </label>

            <input
              name="titre"
              value={form.titre}
              onChange={handleChange}
              required
            />


            <label>
              Type
            </label>

            <select
              name="type"
              value={form.type}
              onChange={handleChange}
            >

              <option>Appartement</option>
              <option>Maison</option>
              <option>Terrain</option>
              <option>Boutique</option>

            </select>

            <label>
              Transaction
            </label>

            <select
              name="transaction_type"
              value={form.transaction_type}
              onChange={handleChange}
            >
              <option value="">Non précisée</option>
              <option value="location">Location</option>
              <option value="vente">Vente</option>
            </select>


            <label>
              Description
            </label>

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows="5"
            />


            <label>
              Prix
            </label>

            <input
              type="number"
              name="prix"
              value={form.prix}
              onChange={handleChange}
              required
            />


            <div className="form-row">

              <div>

                <label>
                  Ville
                </label>

                <input
                  name="ville"
                  value={form.ville}
                  onChange={handleChange}
                  required
                />

              </div>


              <div>

                <label>
                  Quartier
                </label>

                <input
                  name="quartier"
                  value={form.quartier}
                  onChange={handleChange}
                />

              </div>

            </div>


            <div className="form-row">

              <div>

                <label>
                  Chambres
                </label>

                <input
                  type="number"
                  name="chambres"
                  value={form.chambres}
                  onChange={handleChange}
                  min="0"
                />

              </div>


              <div>

                <label>
                  Douches
                </label>

                <input
                  type="number"
                  name="douches"
                  value={form.douches}
                  onChange={handleChange}
                  min="0"
                />

              </div>

            </div>


            <label>
              URL de l'image
            </label>

            <input
              type="url"
              name="image_url"
              value={form.image_url}
              onChange={handleChange}
            />

            <PropertyLocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={({ latitude, longitude }) => {
                setLatitude(latitude);
                setLongitude(longitude);
              }}
            />

            <button
              type="submit"
              className="submit-property-btn"
            >
              Enregistrer les modifications
            </button>

          </form>


          {message && (
            <p className="auth-message">
              {message}
            </p>
          )}

        </div>

      </main>

    </div>
  );
}

export default EditProperty;
