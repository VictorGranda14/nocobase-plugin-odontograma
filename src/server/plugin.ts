import { Plugin } from '@nocobase/server';

const COLECCION_FICHA_CLINICA = 'fichasClinicas';
const COLECCION_FICHA = 'fichaDental';
const COLECCION_LINEAS = 'prestacionesPlanTratamiento';

// El bloque usa la API REST estándar. Solo hace falta lógica de servidor para el guardado conjunto
// desde el formulario de la ficha clínica, que graba ficha dental, plan y prestaciones en una petición.
export class PluginOdontogramaServer extends Plugin {
  async load() {
    this.db.on(`${COLECCION_FICHA_CLINICA}.afterSaveWithAssociations`, async (fichaClinica, { transaction }) => {
      if (!this.db.getCollection(COLECCION_FICHA) || !this.db.getCollection(COLECCION_LINEAS)) return;
      const Linea = this.db.getModel(COLECCION_LINEAS);
      const fichas = await this.db.getModel(COLECCION_FICHA).findAll({
        where: { FK_fichaClinica: fichaClinica.get('id') },
        transaction,
      });
      // Una prestación nueva marcada como realizada no puede apuntar a una ficha que aún no existe:
      // se registra aquí la atención en que se guardó.
      for (const ficha of fichas) {
        const plan = ficha.get('FK_planTratamiento');
        if (!plan) continue;
        await Linea.update(
          { FK_fichaDentalRealizacion: ficha.get('id') },
          { where: { FK_planTratamiento: plan, estado: 'realizado', FK_fichaDentalRealizacion: null }, transaction },
        );
      }
      // Las prestaciones quitadas del plan quedan sin plan al guardar: se eliminan.
      await Linea.destroy({ where: { FK_planTratamiento: null }, transaction });
    });
  }
}

export default PluginOdontogramaServer;
