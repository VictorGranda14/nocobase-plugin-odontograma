import { FilePdfOutlined } from '@ant-design/icons';
import { Button, Col, Row, Space, Switch, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { AgregarPrestacion } from './AgregarPrestacion';
import { DibujoPlan } from './DibujoPlan';
import { TablaPrestaciones } from './TablaPrestaciones';
import { Linea, NuevaLinea, Prestacion } from './tipos';
import { TotalesPlan } from './TotalesPlan';
import { tipoDeDiente, zonaAfectaDiente } from './zonas';

interface PlanOdontogramaProps {
  lineas: Linea[];
  catalogo: Prestacion[];
  cargandoCatalogo?: boolean;
  cargandoLineas?: boolean;
  readOnly: boolean;
  onAgregar: (nueva: NuevaLinea) => Promise<void> | void;
  onAlternarEstado: (linea: Linea) => void;
  onEliminar: (linea: Linea) => void;
  // Si se indica, muestra el botón del presupuesto en PDF; recibe el SVG del odontograma.
  onDescargarPdf?: (svg: SVGSVGElement | null) => Promise<void>;
}

// Vista completa de un plan: odontograma, agregar prestación, tabla y totales. No sabe de dónde vienen las líneas.
export const PlanOdontograma: React.FC<PlanOdontogramaProps> = ({
  lineas,
  catalogo,
  cargandoCatalogo,
  cargandoLineas,
  readOnly,
  onAgregar,
  onAlternarEstado,
  onEliminar,
  onDescargarPdf,
}) => {
  const contenedor = useRef<HTMLDivElement>(null);
  const [diente, setDiente] = useState<string | null>(null);
  const [soloDiente, setSoloDiente] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const lineasVisibles = soloDiente && diente ? lineas.filter((l) => zonaAfectaDiente(l.zona, diente)) : lineas;

  const descargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      // Sin selección, para que el diente seleccionado salga con su color en la imagen.
      if (diente) {
        setDiente(null);
        await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)));
      }
      await onDescargarPdf(contenedor.current?.querySelector('svg') ?? null);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <Row gutter={[24, 16]} data-odontograma>
      <Col span={24}>
        <div ref={contenedor}>
          <DibujoPlan lineas={lineas} diente={diente} onSeleccionarDiente={setDiente} />
        </div>
      </Col>
      <Col span={24}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {diente ? `Diente ${diente} · ${tipoDeDiente(diente)}` : 'Selecciona un diente en el odontograma'}
          </Typography.Title>

          {!readOnly && <AgregarPrestacion catalogo={catalogo} cargando={cargandoCatalogo} diente={diente} onAgregar={onAgregar} />}

          <Space>
            <Switch size="small" checked={soloDiente} disabled={!diente} onChange={setSoloDiente} />
            <Typography.Text>Filtrar solo lo que afecta al diente seleccionado</Typography.Text>
          </Space>

          <TablaPrestaciones
            lineas={lineasVisibles}
            diente={diente}
            readOnly={readOnly}
            cargando={cargandoLineas}
            onAlternarEstado={onAlternarEstado}
            onEliminar={onEliminar}
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
