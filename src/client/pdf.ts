// Se carga con import() dinámico: jsPDF solo se descarga al exportar.
import { jsPDF } from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import franjaUrl from './assets/franja.png';
import logoUrl from './assets/logo.png';
import { ESTADOS, Estado, PDF_CIUDAD, PDF_NOTA_TOTAL, PDF_NOTA_VALIDEZ, PDF_TITULO, clp } from './constants';
import { SIN_SECCION, agruparPorSeccion } from './secciones';
import { etiquetaLinea } from './zonas';

export interface LineaPresupuesto {
  zona: string;
  caras?: string | null;
  prestacion: string;
  estado: Estado;
  precio: number;
  seccion?: string | null;
}

export interface DatosPresupuesto {
  paciente?: string;
  rut?: string;
  profesional?: string;
  fechaAtencion?: string;
  observaciones?: string;
  lineas: LineaPresupuesto[];
  // Un odontograma por dentición, en orden; null si el dibujo está oculto y el PDF va sin él.
  svgs: SVGSVGElement[] | null;
}

export interface ResultadoPdf {
  // Falso si alguno de los odontogramas no se pudo incluir.
  conImagen: boolean;
}

// Medidas de la hoja membretada, en mm. El margen derecho deja libre la franja desde MARGEN_SUPERIOR hacia abajo.
const MARGEN_IZQUIERDO = 30;
const MARGEN_DERECHO = 32;
const MARGEN_SUPERIOR = 36;
const MARGEN_INFERIOR = 20;
const INTERLINEA = 6;
const SANGRIA = 6.35;
const SUBIDA_BLOQUE = 3;
const ESPACIO_OBSERVACIONES = 2;
const ESPACIO_FIRMA = 4;
const ESPACIO_NOMBRE_FIRMA = 2;
const LOGO = { x: 22.9, y: 4.8, ancho: 58.1, alto: 26.6 };
const FRANJA = { ancho: 45.1, alto: 172.1 };

const COLOR_TITULOS: [number, number, number] = [0, 138, 141];
const COLOR_SECCION: [number, number, number] = [224, 245, 244];
const COLOR_LINEAS: [number, number, number] = [200, 214, 214];

// Con este alto caben dos odontogramas en la primera hoja, aunque un nombre ocupe dos líneas.
const ALTO_MAX_IMAGEN = 82;
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

const fechaHoy = () => new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

// El bundler entrega la URL de la imagen y jsPDF necesita sus bytes.
async function leerImagen(url: string): Promise<Uint8Array> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${url}: ${respuesta.status}`);
  return new Uint8Array(await respuesta.arrayBuffer());
}

const sanear = (texto: string) => texto.replace(/[^0-9A-Za-z-]+/g, '');

const filaLinea = (l: LineaPresupuesto) => [etiquetaLinea(l), l.prestacion, ESTADOS[l.estado]?.etiqueta ?? l.estado, clp(l.precio)];

// Igual que la tabla de la pantalla: sin secciones, una lista por zona; con secciones, cada una con su título y subtotal.
function filasDelDetalle(lineas: LineaPresupuesto[]): RowInput[] {
  const grupos = agruparPorSeccion(lineas);
  if (grupos.every((g) => g.nombre === null)) return (grupos[0]?.lineas ?? []).map(filaLinea);
  return grupos.flatMap((grupo) => [
    [{ content: grupo.nombre ?? SIN_SECCION, colSpan: 4, styles: { fontStyle: 'bold', fillColor: COLOR_SECCION } }],
    ...grupo.lineas.map(filaLinea),
    ['', '', { content: 'Subtotal', styles: { fontStyle: 'bold' } }, { content: clp(grupo.subtotal), styles: { fontStyle: 'bold', halign: 'right' } }],
  ] as RowInput[]);
}

export async function generarPresupuestoPdf(datos: DatosPresupuesto): Promise<ResultadoPdf> {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const anchoContenido = anchoPagina - MARGEN_IZQUIERDO - MARGEN_DERECHO;
  const centroContenido = MARGEN_IZQUIERDO + anchoContenido / 2;
  const limiteInferior = doc.internal.pageSize.getHeight() - MARGEN_INFERIOR;
  let y = MARGEN_SUPERIOR;

  const [franja, logo] = await Promise.all([leerImagen(franjaUrl), leerImagen(logoUrl)]);
  const hojasConMembrete = new Set<number>();
  // Con alias, cada imagen se guarda una sola vez aunque el PDF tenga varias hojas.
  const dibujarMembrete = () => {
    const hoja = doc.getCurrentPageInfo().pageNumber;
    if (hojasConMembrete.has(hoja)) return;
    hojasConMembrete.add(hoja);
    doc.addImage(franja, 'PNG', anchoPagina - FRANJA.ancho, 0, FRANJA.ancho, FRANJA.alto, 'franja', 'FAST');
    doc.addImage(logo, 'PNG', LOGO.x, LOGO.y, LOGO.ancho, LOGO.alto, 'logo', 'FAST');
  };

  const asegurarEspacio = (alto: number) => {
    if (y + alto > limiteInferior) {
      doc.addPage();
      dibujarMembrete();
      y = MARGEN_SUPERIOR;
    }
  };
  const lineasDe = (texto: string, sangria = 0) => doc.splitTextToSize(texto, anchoContenido - sangria) as string[];
  const escribir = (texto: string, sangria = 0) => {
    lineasDe(texto, sangria).forEach((linea) => {
      asegurarEspacio(INTERLINEA);
      doc.text(linea, MARGEN_IZQUIERDO + sangria, y);
      y += INTERLINEA;
    });
  };
  const escribirTitulo = (titulo: string) => {
    asegurarEspacio(2 * INTERLINEA);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, MARGEN_IZQUIERDO, y);
    doc.setFont('helvetica', 'normal');
    y += INTERLINEA;
  };

  dibujarMembrete();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${PDF_CIUDAD}, ${fechaHoy()}`, MARGEN_IZQUIERDO, y);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(PDF_TITULO, centroContenido, y, { align: 'center' });
  const anchoTitulo = doc.getTextWidth(PDF_TITULO);
  doc.setLineWidth(0.3);
  doc.line(centroContenido - anchoTitulo / 2, y + 1, centroContenido + anchoTitulo / 2, y + 1);
  y += 11;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const encabezado: [string, string | undefined][] = [
    ['Paciente', datos.paciente],
    ['RUT paciente', datos.rut],
    ['Profesional tratante', datos.profesional],
    ['Fecha de atención', datos.fechaAtencion],
  ];
  encabezado.forEach(([etiqueta, valor]) => escribir(`${etiqueta}: ${valor || '-'}`));
  y += 1;
  escribirTitulo('Detalle del tratamiento:');

  let conImagen = datos.svgs === null || datos.svgs.length > 0;
  for (const svg of datos.svgs ?? []) {
    try {
      const { dataUrl, ancho, alto } = await svgAPng(svg);
      const altoImagen = Math.min(ALTO_MAX_IMAGEN, (anchoContenido * alto) / ancho);
      const anchoImagen = (ancho / alto) * altoImagen;
      // `y` es la línea base del texto: la imagen y la tabla empiezan algo más arriba.
      asegurarEspacio(altoImagen - SUBIDA_BLOQUE);
      doc.addImage(dataUrl, 'PNG', centroContenido - anchoImagen / 2, y - SUBIDA_BLOQUE, anchoImagen, altoImagen, undefined, 'FAST');
      y += altoImagen + 2;
    } catch (error) {
      conImagen = false;
      console.warn('[odontograma] PDF sin imagen:', error);
    }
  }

  const planificado = datos.lineas.filter((l) => l.estado !== 'realizado').reduce((suma, l) => suma + (Number(l.precio) || 0), 0);
  const realizado = datos.lineas.filter((l) => l.estado === 'realizado').reduce((suma, l) => suma + (Number(l.precio) || 0), 0);

  autoTable(doc, {
    startY: y - SUBIDA_BLOQUE,
    margin: { top: MARGEN_SUPERIOR, left: MARGEN_IZQUIERDO, right: MARGEN_DERECHO, bottom: MARGEN_INFERIOR },
    head: [['Zona', 'Prestación', 'Estado', 'Precio']],
    body: filasDelDetalle(datos.lineas),
    foot: [
      ['', '', 'Planificado', clp(planificado)],
      ['', '', 'Realizado', clp(realizado)],
    ],
    showFoot: 'lastPage',
    theme: 'plain',
    styles: { fontSize: 9, lineColor: COLOR_LINEAS, lineWidth: { bottom: 0.1 } },
    headStyles: { fillColor: COLOR_TITULOS, textColor: 255, fontStyle: 'bold' },
    footStyles: { textColor: 20, fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' } },
    // No se usa el pageNumber del hook: vale 1 también si la tabla empieza en una hoja nueva.
    willDrawPage: dibujarMembrete,
    didParseCell: ({ section, column, cell }) => {
      if (section !== 'body' && column.index === 3) cell.styles.halign = 'right';
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0);

  const lineasTotal = [`${clp(planificado + realizado)} CLP`, PDF_NOTA_TOTAL, PDF_NOTA_VALIDEZ].flatMap((texto) => lineasDe(texto, SANGRIA));
  const lineasObservaciones = datos.observaciones ? lineasDe(datos.observaciones, SANGRIA) : [];
  const lineasFirma = datos.profesional ? lineasDe(datos.profesional) : [];
  const altoTotal = (1 + lineasTotal.length) * INTERLINEA;
  const altoObservaciones = lineasObservaciones.length ? ESPACIO_OBSERVACIONES + (1 + lineasObservaciones.length) * INTERLINEA : 0;
  const altoFirma = lineasFirma.length ? ESPACIO_FIRMA + ESPACIO_NOMBRE_FIRMA + (1 + lineasFirma.length) * INTERLINEA : 0;

  // El total y la firma pasan juntos de hoja para que la firma no quede sola.
  asegurarEspacio(altoTotal + altoObservaciones + altoFirma);
  escribirTitulo('Valor total del tratamiento:');
  lineasTotal.forEach((linea) => {
    doc.text(linea, MARGEN_IZQUIERDO + SANGRIA, y);
    y += INTERLINEA;
  });

  if (lineasObservaciones.length) {
    y += ESPACIO_OBSERVACIONES;
    escribirTitulo('Observaciones:');
    lineasObservaciones.forEach((linea) => {
      asegurarEspacio(INTERLINEA);
      doc.text(linea, MARGEN_IZQUIERDO + SANGRIA, y);
      y += INTERLINEA;
    });
  }

  if (lineasFirma.length) {
    // Unas observaciones muy largas pueden ocupar más de una hoja: la firma se reserva de nuevo.
    asegurarEspacio(altoFirma);
    y += ESPACIO_FIRMA;
    doc.text('Atentamente,', MARGEN_IZQUIERDO, y);
    y += INTERLINEA + ESPACIO_NOMBRE_FIRMA;
    lineasFirma.forEach((linea) => {
      doc.text(linea, centroContenido, y, { align: 'center' });
      y += INTERLINEA;
    });
  }

  const hoy = new Date();
  const fecha = [hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  doc.save(`presupuesto-${sanear(datos.rut || 'paciente')}-${fecha}.pdf`);
  return { conImagen };
}
