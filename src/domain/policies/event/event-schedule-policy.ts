export type EventSchedule = {
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const validateEventSchedule = (schedule: EventSchedule): string | null => {
  if (!DATE.test(schedule.fechaInicio) || !DATE.test(schedule.fechaFin)) {
    return "Las fechas deben usar el formato YYYY-MM-DD";
  }
  if (!TIME.test(schedule.horaInicio) || !TIME.test(schedule.horaFin)) {
    return "Las horas deben usar el formato HH:mm";
  }
  if (schedule.fechaFin < schedule.fechaInicio) return "La fecha final no puede ser anterior a la inicial";
  if (schedule.fechaInicio === schedule.fechaFin && schedule.horaFin <= schedule.horaInicio) {
    return "En un evento de un día, la hora final debe ser posterior a la inicial";
  }
  return null;
};

/**
 * An event with tickets is never deleted: its tickets and their immutable history must stay.
 * It is deactivated instead (nobody gets in and no tickets are issued).
 */
export const canDeleteEvent = (ticketCount: number): string | null =>
  ticketCount > 0
    ? `El evento tiene ${ticketCount} boleto(s): desactívalo en lugar de borrarlo para conservar su historial`
    : null;
