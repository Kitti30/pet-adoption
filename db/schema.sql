CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  province TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pets (
  id SERIAL PRIMARY KEY,
  owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('dog','cat','rabbit','bird','other')),
  breed TEXT,
  age_months INT NOT NULL DEFAULT 0,
  gender TEXT NOT NULL DEFAULT 'unknown' CHECK (gender IN ('male','female','unknown')),
  province TEXT NOT NULL,
  description TEXT,
  health_note TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','adopted','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);

CREATE TABLE IF NOT EXISTS adoption_requests (
  id SERIAL PRIMARY KEY,
  pet_id INT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  applicant_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  housing_type TEXT NOT NULL,
  housing_ok BOOLEAN NOT NULL,
  has_experience BOOLEAN NOT NULL,
  has_other_pets BOOLEAN NOT NULL,
  family_agrees BOOLEAN NOT NULL,
  commit_vet BOOLEAN NOT NULL,
  hours_alone TEXT NOT NULL CHECK (hours_alone IN ('lt4','4to8','gt8')),
  monthly_budget INT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  phone TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pet_id, applicant_id)
);
