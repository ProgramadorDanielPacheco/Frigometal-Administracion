import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list'; // <-- NUEVO

import { Proveedor, PrecioProveedor, ProveedorService } from '../../services/proveedor';
import { MaterialService } from '../../services/material'; 

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSnackBarModule, MatTableModule, MatIconModule, MatListModule
  ],
  templateUrl: './proveedores.html'
})
export class ProveedoresComponent implements OnInit {
  
  dataSource = new MatTableDataSource<Proveedor>([]);
 // 👇 Añadimos 'catalogo' antes de las acciones
  columnasMostradas: string[] = ['id_proveedor', 'nombre', 'catalogo', 'acciones'];
  listaMateriales: any[] = []; 
  
  mostrarFormularioProv: boolean = false;
  mostrarFormularioPrecio: boolean = false;
  modoEdicion: boolean = false;

  nuevoProveedor: Proveedor = { nombre: '' };
  nuevoPrecio: PrecioProveedor = { id_proveedor: 0, id_material: 0, precio_unitario: 0, descuento_porcentaje: 0 };
  
  // Variables para editar precios
  preciosEdicion: any[] = []; 

  constructor(
    private proveedorService: ProveedorService,
    private materialService: MaterialService, 
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarProveedores();
    this.cargarMateriales();
  }

  cargarProveedores(): void {
    this.proveedorService.getProveedores().subscribe(datos => {
      this.dataSource.data = datos;
      this.cdr.detectChanges();
    });
  }

  cargarMateriales(): void {
    this.materialService.getMateriales().subscribe(datos => this.listaMateriales = datos);
  }

  obtenerNombreMaterial(idMaterial: number): string {
    const mat = this.listaMateriales.find(m => m.id_material === idMaterial);
    return mat ? mat.nombre : `Material #${idMaterial}`;
  }

  toggleFormProv(): void {
    this.mostrarFormularioProv = !this.mostrarFormularioProv;
    this.mostrarFormularioPrecio = false;
    if(!this.mostrarFormularioProv) this.cancelarEdicion();
    this.cdr.detectChanges();
  }

  toggleFormPrecio(): void {
    this.mostrarFormularioPrecio = !this.mostrarFormularioPrecio;
    this.mostrarFormularioProv = false;
    if(!this.mostrarFormularioPrecio) this.cancelarEdicion();
    this.cdr.detectChanges();
  }

  // ==========================================
  // LÓGICA DE EDICIÓN
  // ==========================================
  editarProveedor(proveedor: Proveedor): void {
    this.modoEdicion = true;
    this.mostrarFormularioProv = true;
    this.mostrarFormularioPrecio = false;
    this.nuevoProveedor = { ...proveedor };
    
    // Traemos los precios de este proveedor
    this.proveedorService.getPreciosProveedor(proveedor.id_proveedor!).subscribe(precios => {
      this.preciosEdicion = precios;
      this.cdr.detectChanges();
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.nuevoProveedor = { nombre: '' };
    this.preciosEdicion = [];
  }

  guardarProveedor(): void {
    if (!this.nuevoProveedor.nombre) {
      this.snackBar.open('⚠️ El nombre es obligatorio', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.modoEdicion && this.nuevoProveedor.id_proveedor) {
      // 1. Actualizamos el nombre
      this.proveedorService.actualizarProveedor(this.nuevoProveedor.id_proveedor, { nombre: this.nuevoProveedor.nombre }).subscribe();

      // 2. Actualizamos cada precio modificado
      for (const precio of this.preciosEdicion) {
        this.proveedorService.actualizarPrecio(precio.id_precio, {
          precio_unitario: precio.precio_unitario,
          descuento_porcentaje: precio.descuento_porcentaje
        }).subscribe();
      }

      this.snackBar.open('✅ Cambios guardados correctamente', 'Genial', { duration: 3000 });
      this.mostrarFormularioProv = false;
      this.cancelarEdicion();
      
      // Damos un pequeño respiro antes de recargar para que el backend procese los bucles
      setTimeout(() => this.cargarProveedores(), 500);

    } else {
      // MODO CREAR
      this.proveedorService.crearProveedor(this.nuevoProveedor).subscribe({
        next: () => {
          this.snackBar.open('✅ Proveedor registrado', 'Genial', { duration: 3000 });
          this.mostrarFormularioProv = false;
          this.cargarProveedores();
          this.nuevoProveedor.nombre = '';
        }
      });
    }
  }

  guardarPrecio(): void {
    if (this.nuevoPrecio.id_proveedor === 0 || this.nuevoPrecio.id_material === 0 || this.nuevoPrecio.precio_unitario <= 0) {
      this.snackBar.open('⚠️ Selecciona proveedor, material y un precio válido', 'Cerrar', { duration: 3000 });
      return;
    }

    this.proveedorService.asignarPrecio(this.nuevoPrecio).subscribe({
      next: () => {
        this.snackBar.open('💲 Precio de compra registrado en el algoritmo', 'Genial', { duration: 4000 });
        this.mostrarFormularioPrecio = false;
        this.nuevoPrecio = { id_proveedor: 0, id_material: 0, precio_unitario: 0, descuento_porcentaje: 0 };
        this.cdr.detectChanges();
      }
    });
  }

  // ... (Tu función onArchivoSeleccionado sigue igual, pégala aquí) ...
  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    if (archivo) {
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Selecciona un Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }
      this.snackBar.open('⏳ Subiendo...', '', { duration: 2000 });
      this.proveedorService.importarProveedoresExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          this.cargarProveedores();
          event.target.value = ''; 
        },
        error: (err) => {
          this.snackBar.open(`❌ Error`, 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }
}