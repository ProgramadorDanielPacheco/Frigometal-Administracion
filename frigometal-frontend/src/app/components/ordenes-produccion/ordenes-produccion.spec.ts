import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdenesProduccion } from './ordenes-produccion';

describe('OrdenesProduccion', () => {
  let component: OrdenesProduccion;
  let fixture: ComponentFixture<OrdenesProduccion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdenesProduccion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrdenesProduccion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
