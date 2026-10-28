// Ignore failures from commands started before a newer login or logout.
let revision = 0;
export const getSessionRevision = (): number => revision;
export const advanceSessionRevision = (): void => { revision++; };
