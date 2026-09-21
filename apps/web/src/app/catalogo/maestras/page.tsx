import { redirect } from 'next/navigation';

/** Compatibilidad: las maestras viven en `/maestras` como destino de menú. */
export default function MaestrasRedirectPage() {
  redirect('/maestras');
}
