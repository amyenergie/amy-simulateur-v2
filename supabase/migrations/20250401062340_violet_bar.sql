/*
  # Création des tables pour les projets solaires

  1. Nouvelles Tables
    - `solar_projects`
      - `id` (uuid, clé primaire)
      - `user_id` (uuid, référence à auth.users)
      - `address` (text)
      - `coordinates` (point)
      - `building_type` (enum)
      - `surface` (text)
      - `residents` (int)
      - `heating_type` (enum)
      - `bill_type` (enum)
      - `bill_unit` (enum)
      - `bill_value` (numeric)
      - `roof_type` (enum)
      - `power_recommendation` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Activation RLS sur la table solar_projects
    - Politique pour permettre aux utilisateurs authentifiés de lire leurs propres projets
    - Politique pour permettre aux utilisateurs authentifiés de créer des projets
*/

-- Création des types énumérés
CREATE TYPE building_type AS ENUM ('house', 'apartment');
CREATE TYPE heating_type AS ENUM ('electric', 'gas', 'fuel', 'wood', 'other');
CREATE TYPE bill_type AS ENUM ('monthly', 'annual');
CREATE TYPE bill_unit AS ENUM ('euros', 'kwh');
CREATE TYPE roof_type AS ENUM ('flat', 'mono', 'dual', 'quad', 'other');

-- Création de la table des projets solaires
CREATE TABLE IF NOT EXISTS solar_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  address text NOT NULL,
  coordinates point NOT NULL,
  building_type building_type NOT NULL,
  surface text NOT NULL,
  residents integer NOT NULL,
  heating_type heating_type NOT NULL,
  bill_type bill_type NOT NULL,
  bill_unit bill_unit NOT NULL,
  bill_value numeric NOT NULL,
  roof_type roof_type NOT NULL,
  power_recommendation numeric NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activation de la sécurité niveau ligne
ALTER TABLE solar_projects ENABLE ROW LEVEL SECURITY;

-- Politique pour la lecture des projets
CREATE POLICY "Users can read own projects"
  ON solar_projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique pour la création des projets
CREATE POLICY "Users can create projects"
  ON solar_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_solar_projects_updated_at
  BEFORE UPDATE ON solar_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();