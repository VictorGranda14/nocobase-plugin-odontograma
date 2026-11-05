import { FilePdfOutlined } from '@ant-design/icons';
import { Denticion } from '@gransalud/odontograma-react';
import { Button, Col, Row, Space, Switch, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { AgregarPrestacion } from './AgregarPrestacion';
import { DibujoPlan } from './DibujoPlan';
import { nombresDeSecciones } from './secciones';
import { TablaPrestaciones } from './TablaPrestaciones';
import { Linea, NuevaLinea, Prestacion } from './tipos';
import { TotalesPlan } from './TotalesPlan';
import { alcanceDeZona, denticionesConPrestaciones, etiquetaZona, tipoDeDiente, zonaAfecta } from './zonas';

interface PlanOdontogramaProps {
  lineas: Linea[];
  catalogo: Prestacion[];
  cargandoCatalogo?: boolean;
  cargandoLineas?: boolean;
  readOnly: boolean;
  mostrar: boolean;
  onCambiarMostrar: (mostrar: boolean) => void;
  onAgregar: (nueva: NuevaLinea) => Promise<void> | void;
  onAlternarEstado: (linea: Linea) => void;
  onEliminar: (linea: Linea) => void;
  onRenombrarSeccion: (nombre: string, nuevo: string) => void;
  onEliminarSeccion: (nombre: string) => void;
  // Si se indica, muestra el botón del presupuesto en PDF; recibe el SVG de cada odontograma, o null si el dibujo está oculto.
  onDescargarPdf?: (svgs: SVGSVGElement[] | null) => Promise<void>;
}

const titulo = (zona: string | null, caras: string[]) => {
  if (!zona) return 'Selecciona un diente o una zona en el odontograma';
  return alcanceDeZona(zona) === 'diente' ? [etiquetaZona(zona), tipoDeDiente(zona), ...caras].join(' · ') : etiquetaZona(zona);
};

// Vista completa de un plan: odontograma, agregar prestación, tabla y totales. No sabe de dónde vienen las líneas.
export const PlanOdontograma: React.FC<PlanOdontogramaProps> = ({
  lineas,
  catalogo,
  cargandoCatalogo,
  cargandoLineas,
  readOnly,
  mostrar,
  onCambiarMostrar,
  onAgregar,
  onAlternarEstado,
  onEliminar,
  onRenombrarSeccion,
  onEliminarSeccion,
  onDescargarPdf,
}) => {
  const contenedor = useRef<HTMLDivElement>(null);
  const [zona, setZona] = useState<string | null>(null);
  const [caras, setCaras] = useState<string[]>([]);
  const [soloSeleccion, setSoloSeleccion] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [capturar, setCapturar] = useState<Denticion[]>([]);

  const seleccionarZona = (nueva: string) => {
    setZona(nueva);
    setCaras([]);
  };

  // Marca o desmarca una cara del diente seleccionado; en otro diente, la selección pasa a él con solo esa cara.
  const marcarCara = (diente: string, cara: string) => {
    if (zona !== diente) {
      setZona(diente);
      setCaras([cara]);
      return;
    }
    setCaras((actuales) => (actuales.includes(cara) ? actuales.filter((c) => c !== cara) : [...actuales, cara]));
  };

  const filtro = mostrar && soloSeleccion && zona ? (l: Linea) => zonaAfecta(l.zona, zona) : undefined;

  // Dibuja fuera de pantalla cada dentición con prestaciones y las pasa al PDF.
  const descargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      if (!mostrar) {
        await onDescargarPdf(null);
        return;
      }
      setCapturar(denticionesConPrestaciones(lineas));
      await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)));
      const svgs = Array.from(contenedor.current?.querySelectorAll<SVGSVGElement>('[data-captura-pdf] > div > svg') ?? []);
      await onDescargarPdf(svgs);
    } finally {
      setCapturar([]);
      setGenerandoPdf(false);
    }
  };

  return (
    <Row gutter={[24, 16]} data-odontograma>
      <Col span={24}>
        <Space>
          <Switch size="small" aria-label="Mostrar odontograma" checked={mostrar} disabled={readOnly} onChange={onCambiarMostrar} />
          <Typography.Text>Mostrar odontograma</Typography.Text>
        </Space>
      </Col>
      {mostrar && (
        <Col span={24}>
          <div ref={contenedor}>
            <DibujoPlan lineas={lineas} zona={zona} caras={caras} onSeleccionarZona={seleccionarZona} onMarcarCara={marcarCara} capturar={capturar} />
          </div>
        </Col>
      )}
      <Col span={24}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {mostrar && (
            <Typography.Title level={5} style={{ margin: 0 }}>
              {titulo(zona, caras)}
            </Typography.Title>
          )}

          {!readOnly && <AgregarPrestacion catalogo={catalogo} secciones={nombresDeSecciones(lineas)} cargando={cargandoCatalogo} seleccion={zona} caras={caras} dibujoOculto={!mostrar} onSeleccionarZona={seleccionarZona} onMarcarCara={marcarCara} onAgregar={onAgregar} />}

          {mostrar && (
            <Space>
              <Switch data-filtro size="small" checked={soloSeleccion} disabled={!zona} onChange={setSoloSeleccion} />
              <Typography.Text>Filtrar solo lo que afecta a la selección</Typography.Text>
            </Space>
          )}

          <TablaPrestaciones
            lineas={lineas}
            filtro={filtro}
            zona={mostrar ? zona : null}
            readOnly={readOnly}
            cargando={cargandoLineas}
            onAlternarEstado={onAlternarEstado}
            onEliminar={onEliminar}
            onRenombrarSeccion={onRenombrarSeccion}
            onEliminarSeccion={onEliminarSeccion}
          />

          <TotalesPlan
            lineas={lineas}
            acciones={
              onDescargarPdf && (
                <Button icon={<FilePdfOutlined />} loading={generandoPdf} disabled={!lineas.length} onClick={descargarPdf}>
                  Descargar presupuesto (PDF)
                </Button>
              )
            }
          />
        </Space>
      </Col>
    </Row>
  );
};
