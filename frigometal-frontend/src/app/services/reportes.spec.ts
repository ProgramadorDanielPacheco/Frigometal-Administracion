import { TestBed } from '@angular/core/testing';

import { ReportesService } from './reportes';

describe('Reportes', () => {
  let service: ReportesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReportesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
