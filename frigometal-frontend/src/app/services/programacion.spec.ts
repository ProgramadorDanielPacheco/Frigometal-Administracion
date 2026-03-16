import { TestBed } from '@angular/core/testing';

import { ProgramacionService } from './programacion';

describe('Programacion', () => {
  let service: ProgramacionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProgramacionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
