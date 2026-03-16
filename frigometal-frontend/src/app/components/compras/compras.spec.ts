import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComprasComponent } from './compras';

describe('Compras', () => {
  let component: ComprasComponent;
  let fixture: ComponentFixture<ComprasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComprasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComprasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
