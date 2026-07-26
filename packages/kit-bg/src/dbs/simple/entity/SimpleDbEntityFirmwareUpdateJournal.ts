import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityFirmwareUpdateJournal extends SimpleDbEntityBase<unknown> {
  entityName = 'firmwareUpdateJournal';

  override enableCache = false;
}

export const firmwareUpdateJournalEntity =
  new SimpleDbEntityFirmwareUpdateJournal();
