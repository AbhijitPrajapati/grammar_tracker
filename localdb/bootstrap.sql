-- Local bootstrap representation of the production schema
-- The Next.js application never executes this file in
-- production and never applies DDL at runtime or during a Vercel build

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email citext(320) NOT NULL,
    password_hash varchar(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users USING btree (email);

CREATE TABLE speeches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transcript text NOT NULL,
    analysis jsonb NOT NULL,
    CONSTRAINT speeches_pkey PRIMARY KEY (id),
    CONSTRAINT speeches_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX ix_speeches_user_id ON speeches USING btree (user_id);

CREATE TABLE mistake_frequencies (
    speech_id uuid NOT NULL,
    category varchar(64) NOT NULL,
    opportunities integer NOT NULL,
    occurrences integer NOT NULL,
    CONSTRAINT mistake_frequencies_pkey PRIMARY KEY (speech_id, category),
    CONSTRAINT ck_mistake_frequencies_valid_counts CHECK (
        occurrences >= 0
        AND opportunities >= 0
        AND occurrences <= opportunities
    ),
    CONSTRAINT mistake_frequencies_speech_id_fkey
        FOREIGN KEY (speech_id) REFERENCES speeches(id) ON DELETE CASCADE
);

-- Retained only so disposable local databases have the same administrative
-- marker as the existing production database. Drizzle does not use it.
CREATE TABLE alembic_version (
    version_num varchar(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INSERT INTO alembic_version (version_num) VALUES ('9b8ea2f7c1d0');
