-- Migration: Adiciona campos de endereço, whatsapp, feedback e status de lead em divulgacao_tarefas
 
ALTER TABLE divulgacao_tarefas
  ADD COLUMN endereco text,
  ADD COLUMN whatsapp text,
  ADD COLUMN feedback text,
  ADD COLUMN lead_status text CHECK (lead_status IN ('lead', 'nao_lead')); 