// Função para exibir data no formato local (pt-BR)
export function formatDateToLocal(dateString: string | Date): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

// Função para garantir valor correto no input type='date'
export function getInputDateValue(dateString: string | Date): string {
  if (!dateString) return '';
  if (typeof dateString === 'string') return dateString.slice(0, 10);
  return dateString.toISOString().slice(0, 10);
}

// Exibe a data UTC pura, sem conversão de fuso
export function formatDateUTC(dateString: string | Date): string {
  if (!dateString) return '';
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString.split('-').reverse().join('/');
  }
  const iso = typeof dateString === 'string' ? dateString : dateString.toISOString();
  return iso.slice(0, 10).split('-').reverse().join('/');
} 