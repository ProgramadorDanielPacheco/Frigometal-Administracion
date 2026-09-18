import { TestBed } from '@angular/core/testing';

import { ReporteTecnicoService } from './reporte-tecnico';

describe('ReporteTecnico', () => {
  let service: ReporteTecnicoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReporteTecnicoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
