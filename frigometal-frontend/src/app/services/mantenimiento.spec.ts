import { TestBed } from '@angular/core/testing';

import { MantenimientoService } from './mantenimiento';

describe('Mantenimiento', () => {
  let service: MantenimientoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MantenimientoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
