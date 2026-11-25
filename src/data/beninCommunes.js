export const BENIN_COMMUNES = [
  { label: "Cotonou", value: "Cotonou" },
  { label: "Abomey-Calavi", value: "Calavi" },
  { label: "Porto-Novo", value: "Porto-Novo" },
  { label: "Parakou", value: "Parakou" },
  { label: "Djougou", value: "Djougou" },
  { label: "Bohicon", value: "Bohicon" },
  { label: "Ouidah", value: "Ouidah" },
  { label: "Natitingou", value: "Natitingou" },
  { label: "Abomey", value: "Abomey" },
  { label: "Lokossa", value: "Lokossa" },
  { label: "Savalou", value: "Savalou" },
  { label: "Kandi", value: "Kandi" },
  { label: "Savè", value: "Savè" },
  { label: "Pobè", value: "Pobè" },
  { label: "Kétou", value: "Kétou" },
  { label: "Malanville", value: "Malanville" },
  { label: "Nikki", value: "Nikki" },
  { label: "Banikoara", value: "Banikoara" },
  { label: "Allada", value: "Allada" },
  { label: "Comè", value: "Comè" },
  { label: "Grand-Popo", value: "Grand-Popo" },
  { label: "Dassa-Zoumè", value: "Dassa-Zoumè" },
  { label: "Bembèrèkè", value: "Bembèrèkè" },
  { label: "Sakété", value: "Sakété" },
  { label: "Aplahoué", value: "Aplahoué" },
];

export function normalizeCommune(value = "") {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
  return normalized === "abomey-calavi" ? "calavi" : normalized;
}

export function getCommuneFilterValue(value = "") {
  const selected = normalizeCommune(value);
  const commune = BENIN_COMMUNES.find(
    ({ label, value: filterValue }) =>
      normalizeCommune(label) === selected || normalizeCommune(filterValue) === selected
  );
  return commune?.value || String(value).trim();
}
