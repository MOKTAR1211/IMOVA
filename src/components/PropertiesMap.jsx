import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const propertyIcon = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

function MapController({ selectedProperty }) {
  const map = useMap();
  if (selectedProperty && selectedProperty.latitude && selectedProperty.longitude) {
    map.flyTo(
      [
        Number(selectedProperty.latitude),
        Number(selectedProperty.longitude)
      ],
      16
    );
  }
  return null;
}

function PropertiesMap({
  properties,
  selectedProperty,
  onSelectProperty
}) {
  const defaultCenter = properties.length > 0 && properties[0].latitude
    ? [Number(properties[0].latitude), Number(properties[0].longitude)]
    : [6.36536, 2.41833];

  return (
    <MapContainer center={defaultCenter} zoom={13} scrollWheelZoom={false} className="properties-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController selectedProperty={selectedProperty} />
      {properties.map((property) => {
        if (!property.latitude || !property.longitude) {
          return null;
        }
        return (
          <Marker
            key={property.id}
            position={[Number(property.latitude), Number(property.longitude)]}
            icon={propertyIcon}
            eventHandlers={{
              click: () => onSelectProperty(property)
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>{property.titre}</strong>
                <p>
                  📍 {property.ville}
                  {property.quartier && ` - ${property.quartier}`}
                </p>
                <b>
                  {Number(property.prix).toLocaleString("fr-FR")} FCFA
                </b>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export default PropertiesMap;
