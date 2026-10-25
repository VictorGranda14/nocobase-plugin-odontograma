// Se carga con import() dinámico: jsPDF solo se descarga al exportar.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ESTADOS, Estado, PDF_NOTA_VALIDEZ, PDF_TITULO, clp } from './constants';
import { etiquetaZona } from './zonas';

export interface LineaPresupuesto {
  zona: string;
  prestacion: string;
  estado: Estado;
  precio: number;
}

export interface DatosPresupuesto {
  paciente?: string;
  rut?: string;
  profesional?: string;
  fechaAtencion?: string;
  observaciones?: string;
  lineas: LineaPresupuesto[];
  svg?: SVGSVGElement | null;
}

export interface ResultadoPdf {
  conImagen: boolean;
}

const MARGEN = 15;
// El odontograma es más alto que ancho: se limita para que la tabla quepa en la primera hoja.
const ALTO_MAX_IMAGEN = 85;
const PROPIEDADES_SVG = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'display', 'visibility'];

// Copia los estilos calculados a atributos para que el SVG se vea igual fuera de la página.
function clonarConEstilos(svg: SVGSVGElement): SVGSVGElement {
  const clon = svg.cloneNode(true) as SVGSVGElement;
  const originales = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const copias = [clon, ...Array.from(clon.querySelectorAll('*'))];
  originales.forEach((original, i) => {
    const estilo = window.getComputedStyle(original);
    const copia = copias[i] as SVGElement;
    PROPIEDADES_SVG.forEach((propiedad) => {
      const valor = estilo.getPropertyValue(propiedad);
      if (valor) copia.style.setProperty(propiedad, valor);
    });
  });
  const { width, height } = svg.getBoundingClientRect();
  clon.setAttribute('width', String(width));
  clon.setAttribute('height', String(height));
  clon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return clon;
}

function svgAPng(svg: SVGSVGElement): Promise<{ dataUrl: string; ancho: number; alto: number }> {
  const clon = clonarConEstilos(svg);
  const ancho = Number(clon.getAttribute('width'));
  const alto = Number(clon.getAttribute('height'));
  const texto = new XMLSerializer().serializeToString(clon);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => {
      const escala = 2;
      const canvas = document.createElement('canvas');
      canvas.width = ancho * escala;
      canvas.height = alto * escala;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas no disponible'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), ancho, alto });
    };
    imagen.onerror = () => reject(new Error('No se pudo convertir el odontograma'));
    imagen.src = url;
  });
}

const fechaHoy = () => new Date().toLocaleDateString('es-CL');

const sanear = (texto: string) => texto.replace(/[^0-9A-Za-z-]+/g, '');

export async function generarPresupuestoPdf(datos: DatosPresupuesto): Promise<ResultadoPdf> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  let y = MARGEN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(PDF_TITULO, MARGEN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Emitido el ${fechaHoy()}`, anchoPagina - MARGEN, y, { align: 'right' });
  y += 9;

  doc.setFontSize(10);
  const encabezado: [string, string | undefined][] = [
    ['Paciente', datos.paciente],
    ['RUT', datos.rut],
    ['Profesional', datos.profesional],
    ['Fecha de atención', datos.fechaAtencion],
  ];
  encabezado.forEach(([etiqueta, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${etiqueta}:`, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(valor || '-', MARGEN + 35, y);
    y += 5.5;
  });
  y += 2;

  let conImagen = false;
  if (datos.svg) {
    try {
      const { dataUrl, ancho, alto } = await svgAPng(datos.svg);
      const altoImagen = Math.min(ALTO_MAX_IMAGEN, ((anchoPagina - 2 * MARGEN) * alto) / ancho);
      const anchoImagen = (ancho / alto) * altoImagen;
      doc.addImage(dataUrl, 'PNG', (anchoPagina - anchoImagen) / 2, y, anchoImagen, altoImagen, undefined, 'FAST');
      y += altoImagen + 4;
      conImagen = true;
    } catch (error) {
      console.warn('[odontograma] PDF sin imagen:', error);
    }
  }

  const planificado = datos.lineas.filter((l) => l.estado !== 'realizado').reduce((suma, l) => suma + (Number(l.precio) || 0), 0);
  const realizado = datos.lineas.filter((l) => l.estado === 'realizado').reduce((suma, l) => suma + (Number(l.precio) || 0), 0);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [['Zona', 'Prestación', 'Estado', 'Precio']],
    body: datos.lineas.map((l) => [etiquetaZona(l.zona), l.prestacion, ESTADOS[l.estado]?.etiqueta ?? l.estado, clp(l.precio)]),
    foot: [
      ['', '', 'Planificado', clp(planificado)],
      ['', '', 'Realizado', clp(realizado)],
      ['', '', 'Total', clp(planificado + realizado)],
    ],
    showFoot: 'lastPage',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [22, 119, 255] },
    footStyles: { fillColor: [245, 245, 245], textColor: 20 },
    columnStyles: { 3: { halign: 'right' } },
    didParseCell: ({ section, column, cell }) => {
      if (section === 'foot' && column.index === 3) cell.styles.halign = 'right';
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  const alturaPagina = doc.internal.pageSize.getHeight();
  const escribirParrafo = (titulo: string | null, texto: string) => {
    const lineas = doc.splitTextToSize(texto, anchoPagina - 2 * MARGEN);
    const alto = lineas.length * 4.5 + (titulo ? 5 : 0);
    if (y + alto > alturaPagina - MARGEN) {
      doc.addPage();
      y = MARGEN;
    }
    if (titulo) {
      doc.setFont('helvetica', 'bold');
      doc.text(titulo, MARGEN, y);
      y += 5;
    }
    doc.setFont('helvetica', 'normal');
    doc.text(lineas, MARGEN, y);
    y += lineas.length * 4.5 + 4;
  };

  doc.setFontSize(9);
  if (datos.observaciones) escribirParrafo('Observaciones', datos.observaciones);
  escribirParrafo(null, PDF_NOTA_VALIDEZ);

  const hoy = new Date();
  const fecha = [hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  doc.save(`presupuesto-${sanear(datos.rut || 'paciente')}-${fecha}.pdf`);
  return { conImagen };
}
