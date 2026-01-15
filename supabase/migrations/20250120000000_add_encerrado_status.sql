-- Adicionar status 'encerrado' ao enum project_status
-- Nota: PostgreSQL não suporta IF NOT EXISTS para ALTER TYPE, então verificamos se já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'encerrado' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'encerrado';
    END IF;
END $$;
