import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportesTecnicos } from './reportes-tecnicos';

describe('ReportesTecnicos', () => {
  let component: ReportesTecnicos;
  let fixture: ComponentFixture<ReportesTecnicos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportesTecnicos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportesTecnicos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
