import { TestBed } from '@angular/core/testing';

import { RecetaService } from './receta';

describe('Receta', () => {
  let service: RecetaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecetaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
