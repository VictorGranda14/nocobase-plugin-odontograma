import { Col, Row, Statistic } from 'antd';
import React from 'react';
import { clp } from './constants';
import { Linea } from './tipos';

interface TotalesPlanProps {
  lineas: Linea[];
  acciones?: React.ReactNode;
}

// Planificado, realizado y total del plan, con acciones opcionales a la derecha.
export const TotalesPlan: React.FC<TotalesPlanProps> = ({ lineas, acciones }) => {
  const total = lineas.reduce((suma, l) => suma + (Number(l.precio) || 0), 0);
  const realizado = lineas.filter((l) => l.estado === 'realizado').reduce((suma, l) => suma + (Number(l.precio) || 0), 0);
  return (
    <Row gutter={16} align="middle">
      <Col>
        <Statistic title="Planificado" value={clp(total - realizado)} />
      </Col>
      <Col>
        <Statistic title="Realizado" value={clp(realizado)} />
      </Col>
      <Col>
        <Statistic title="Total" value={clp(total)} valueStyle={{ fontWeight: 600 }} />
      </Col>
      <Col flex="auto" style={{ textAlign: 'right' }}>
        {acciones}
      </Col>
    </Row>
  );
};
