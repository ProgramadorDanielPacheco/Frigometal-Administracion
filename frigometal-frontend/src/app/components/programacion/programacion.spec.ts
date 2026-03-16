import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgramacionComponent } from './programacion';

describe('Programacion', () => {
  let component: ProgramacionComponent;
  let fixture: ComponentFixture<ProgramacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgramacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProgramacionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
