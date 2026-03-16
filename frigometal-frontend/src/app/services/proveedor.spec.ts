import { TestBed } from '@angular/core/testing';

import { ProveedorService } from './proveedor';

describe('Proveedor', () => {
  let service: ProveedorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProveedorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
