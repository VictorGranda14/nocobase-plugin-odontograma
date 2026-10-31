import { PlusOutlined } from '@ant-design/icons';
import { useRequest } from '@nocobase/client';
import { Button, Empty, Select, Space, Typography } from 'antd';
import React, { useState } from 'react';
import { CAMPOS_PLAN, COLECCION_PLAN, fechaCL } from './constants';

interface Plan {
  id: number;
  createdAt: string;
  prestacionesAsociadas?: unknown[];
}

interface ElegirPlanProps {
  pacienteId?: number | null;
  readOnly: boolean;
  onCrear: () => Promise<void>;
  onContinuar: (planId: number) => Promise<void>;
}

const etiquetaPlan = (plan: Plan) => {
  const cantidad = plan[CAMPOS_PLAN.lineas]?.length ?? 0;
  return `Plan iniciado el ${fechaCL(plan.createdAt)} · ${cantidad} ${cantidad === 1 ? 'prestación' : 'prestaciones'}`;
};

// Una ficha dental sin plan: se crea uno nuevo o se continúa uno del mismo paciente.
export const ElegirPlan: React.FC<ElegirPlanProps> = ({ pacienteId, readOnly, onCrear, onContinuar }) => {
  const [planId, setPlanId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const planesReq = useRequest<{ data: Plan[] }>(
    {
      resource: COLECCION_PLAN,
      action: 'list',
      params: {
        filter: { [CAMPOS_PLAN.fkPaciente]: pacienteId },
        appends: [CAMPOS_PLAN.lineas],
        paginate: false,
        sort: ['-id'],
      },
    },
    { ready: !!pacienteId && !readOnly, refreshDeps: [pacienteId] },
  );

  if (readOnly) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Esta atención no tiene plan de tratamiento." />;
  }

  const ejecutar = async (accion: () => Promise<void>) => {
    setGuardando(true);
    try {
      await accion();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Space direction="vertical" size="middle">
      <Typography.Text>Esta atención aún no tiene plan de tratamiento.</Typography.Text>
      <Button type="primary" icon={<PlusOutlined />} loading={guardando} onClick={() => ejecutar(onCrear)}>
        Crear plan nuevo
      </Button>
      <Space wrap>
        <Select
          style={{ minWidth: 320 }}
          placeholder="Continuar un plan del paciente"
          loading={planesReq.loading}
          options={(planesReq.data?.data ?? []).map((plan) => ({ value: plan.id, label: etiquetaPlan(plan) }))}
          value={planId}
          onChange={setPlanId}
          notFoundContent="El paciente no tiene planes anteriores"
        />
        <Button disabled={!planId} loading={guardando} onClick={() => ejecutar(() => onContinuar(planId))}>
          Continuar plan
        </Button>
      </Space>
    </Space>
  );
};
