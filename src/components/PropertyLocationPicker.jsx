import { useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./PropertyLocationPicker.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const BENIN_CENTER = [9.3077, 2.3158];

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function PropertyLocationPicker({
  latitude,
  longitude,
  onChange,
}) {
  const hasCoordinates =
    latitude !== "" &&
    longitude !== "" &&
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));

  const position = hasCoordinates
    ? [Number(latitude), Number(longitude)]
    : null;

  const center = position || BENIN_CENTER;

  const [mapKey, setMapKey] = useState(0);

  function selectPosition(lat, lng) {
    onChange({
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    });
  }

  return (
    <section className="location-picker">
      <h3>Localisation du bien</h3>
      <p>
        Clique sur la carte pour placer le marqueur à l’endroit du bien.
        Tu peux aussi déplacer le marqueur.
      </p>

      <MapContainer
        key={mapKey}
        center={center}
        zoom={position ? 15 : 7}
        className="location-picker-map"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onSelect={selectPosition} />

        {position && (
          <Marker
            position={position}
            icon={defaultIcon}
            draggable
            eventHandlers={{
              dragend(event) {
                const point = event.target.getLatLng();
                selectPosition(point.lat, point.lng);
              },
            }}
          >
            <Popup>Emplacement du bien</Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="location-coordinates">
        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={latitude ?? ""}
            onChange={(e) =>
              onChange({
                latitude: e.target.value,
                longitude: longitude ?? "",
              })
            }
            placeholder="Ex. 6.3654"
          />
        </label>

        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={longitude ?? ""}
            onChange={(e) =>
              onChange({
                latitude: latitude ?? "",
                longitude: e.target.value,
              })
            }
            placeholder="Ex. 2.4183"
          />
        </label>
      </div>

      <button
        type="button"
        className="location-reset"
        onClick={() => {
          onChange({ latitude: "", longitude: "" });
          setMapKey((key) => key + 1);
        }}
      >
        Effacer la position
      </button>

      {!hasCoordinates && (
        <p className="location-warning">
          Aucune position sélectionnée. Clique sur la carte avant de publier
          si tu veux afficher le bien sur la carte des annonces.
        </p>
      )}
    </section>
  );
}
