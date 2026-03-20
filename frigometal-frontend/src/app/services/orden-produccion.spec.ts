import { TestBed } from '@angular/core/testing';

import { OrdenProduccionService } from './orden-produccion';

describe('OrdenProduccion', () => {
  let service: OrdenProduccionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrdenProduccionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
