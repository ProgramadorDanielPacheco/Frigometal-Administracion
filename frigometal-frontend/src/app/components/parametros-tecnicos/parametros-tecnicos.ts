import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from "@angular/material/icon";

import { Producto, ProductoService } from '../../services/producto';
import { ParametroPoliuretano, Parametros } from '../../services/parametros';

@Component({
  selector: 'app-parametros-tecnicos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatTableModule, MatSnackBarModule, MatIconModule
  ],
  templateUrl: './parametros-tecnicos.html',
  styleUrls: ['./parametros-tecnicos.scss']
})
export class ParametrosTecnicos implements OnInit {
  
  productos: Producto[] = [];
  dataSource = new MatTableDataSource<Producto>([]);
  columnasMostradas: string[] = ['id_producto', 'nombre', 'parametro', 'acciones'];
  textoBusqueda: string = '';

  productoSeleccionado: Producto | null = null;
  filasPoliuretano: ParametroPoliuretano[] = [];
  guardando: boolean = false;

  constructor(
    private productoService: ProductoService,
    private parametros: Parametros,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef // 👈 INYECTAMOS EL DETECTOR DE CAMBIOS
  ) {}

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.productoService.getProductos().subscribe(datos => {
      this.productos = datos;
      this.dataSource.data = datos;
    });
  }

  aplicarFiltroTexto(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.textoBusqueda = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  abrirPoliuretano(prod: Producto): void {
    this.productoSeleccionado = prod;
    this.filasPoliuretano = [];
    
    // 👇 1. FORZAMOS A ANGULAR A DIBUJAR EL PANEL INMEDIATAMENTE 👇
    this.cdr.detectChanges(); 
    
    // 👇 2. NAVEGAMOS AUTOMÁTICAMENTE AL PANEL 👇
    setTimeout(() => {
      const panelPoliuretano = document.getElementById('panel-poliuretano');
      if (panelPoliuretano) {
        panelPoliuretano.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);

    // 3. Consultamos la base de datos (mientras la pantalla ya bajó)
    this.parametros.getParametros(prod.id_producto!).subscribe(datosExistentes => {
      this.filasPoliuretano = datosExistentes;
      
      // La regla es: Siempre generar la tabla con 10 espacios iniciales
      const faltantes = 10 - this.filasPoliuretano.length;
      for (let i = 0; i < faltantes; i++) {
        this.agregarFila();
      }
    });
  }

  cerrarPoliuretano(): void {
    this.productoSeleccionado = null;
    this.filasPoliuretano = [];
  }

  agregarFila(): void {
    this.filasPoliuretano.push({
      parte: '',
      largo: null, ancho: null, espesor: null,
      poliol: null, isocianato: null
    });
  }

  eliminarFila(index: number): void {
    this.filasPoliuretano.splice(index, 1);
  }

  // Cálculos Automáticos de Totales
  get totalPoliol(): number {
    return this.filasPoliuretano.reduce((acc, fila) => acc + (Number(fila.poliol) || 0), 0);
  }

  get totalIsocianato(): number {
    return this.filasPoliuretano.reduce((acc, fila) => acc + (Number(fila.isocianato) || 0), 0);
  }

  guardarParametros(): void {
    if (!this.productoSeleccionado || !this.productoSeleccionado.id_producto) return;
    
    this.guardando = true;
    this.snackBar.open('⏳ Guardando parámetros técnicos...', '', { duration: 2000 });

    this.parametros.guardarParametros(this.productoSeleccionado.id_producto, this.filasPoliuretano).subscribe({
      next: (resp) => {
        this.snackBar.open('✅ Parámetros guardados con éxito', 'Excelente', { duration: 3000 });
        this.guardando = false;
      },
      error: (err) => {
        this.snackBar.open('❌ Error al guardar datos', 'Cerrar', { duration: 4000 });
        this.guardando = false;
      }
    });
  }
}
