import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParametrosTecnicos } from './parametros-tecnicos';

describe('ParametrosTecnicos', () => {
  let component: ParametrosTecnicos;
  let fixture: ComponentFixture<ParametrosTecnicos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParametrosTecnicos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParametrosTecnicos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
