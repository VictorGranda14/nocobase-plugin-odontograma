import { useRequest } from '@nocobase/client';
import { CAMPOS_CATALOGO, COLECCION_CATALOGO, Estado } from './constants';
import { Alcance } from './zonas';

export interface Prestacion {
  id: number;
  nombrePrestacion: string;
  alcance: Alcance;
  precio: number;
  color?: string;
}

export interface Linea {
  id: number;
  zona: string;
  precio: number;
  estado: Estado;
  seccion?: string | null;
  notas?: string;
  FK_prestacion?: number;
  prestacionAsociada?: Prestacion;
  FK_fichaDentalRealizacion?: number | null;
  fichaDentalRealizacion?: { id: number; fecha?: string } | null;
}

export interface NuevaLinea {
  prestacion: Prestacion;
  zona: string;
  precio: number;
  seccion: string | null;
}

// Catálogo de prestaciones activas, ordenado por nombre.
export const useCatalogo = () => {
  const catalogoReq = useRequest<{ data: Prestacion[] }>({
    resource: COLECCION_CATALOGO,
    action: 'list',
    params: {
      filter: { [CAMPOS_CATALOGO.activo]: true },
      paginate: false,
      sort: [CAMPOS_CATALOGO.nombre],
    },
  });
  return { catalogo: catalogoReq.data?.data ?? [], cargando: catalogoReq.loading };
};
