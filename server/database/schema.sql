-- Schéma PostgreSQL pour IMMO229

CREATE TABLE IF NOT EXISTS utilisateurs (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  telephone VARCHAR(30),
  role VARCHAR(30) DEFAULT 'particulier', -- 'particulier', 'proprietaire', 'admin'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS biens (
  id SERIAL PRIMARY KEY,
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  prix NUMERIC(12, 2) NOT NULL,
  ville VARCHAR(100) NOT NULL,
  quartier VARCHAR(100),
  type VARCHAR(50) NOT NULL, -- 'Appartement', 'Maison', 'Terrain', 'Boutique'
  statut VARCHAR(50) DEFAULT 'À louer', -- 'À louer', 'À vendre'
  chambres INT DEFAULT 0,
  douches INT DEFAULT 0,
  surface NUMERIC(8, 2),
  proprietaire_id INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  is_principale BOOLEAN DEFAULT FALSE,
  bien_id INT NOT NULL REFERENCES biens(id) ON DELETE CASCADE
);
