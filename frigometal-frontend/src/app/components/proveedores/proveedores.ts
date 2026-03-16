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

import { Proveedor, PrecioProveedor, ProveedorService } from '../../services/proveedor';
// IMPORTANTE: Ajusta la ruta a tu servicio de materiales
import { MaterialService } from '../../services/material'; 

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSnackBarModule, MatTableModule, MatIconModule
  ],
  templateUrl: './proveedores.html'
})
export class ProveedoresComponent implements OnInit {
  
  // Tablas y Listas
  dataSource = new MatTableDataSource<Proveedor>([]);
  columnasMostradas: string[] = ['id_proveedor', 'nombre'];
  listaMateriales: any[] = []; // Para el selector de materiales
  
  // Variables para los formularios
  mostrarFormularioProv: boolean = false;
  mostrarFormularioPrecio: boolean = false;

  nuevoProveedor: Proveedor = { nombre: '' };
  
  nuevoPrecio: PrecioProveedor = {
    id_proveedor: 0,
    id_material: 0,
    precio_unitario: 0,
    descuento_porcentaje: 0
  };

  constructor(
    private proveedorService: ProveedorService,
    private materialService: MaterialService, // <-- Necesario para cargar materiales
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
    // Ajusta la función si en tu servicio se llama distinto (ej. getInsumos)
    this.materialService.getMateriales().subscribe(datos => {
      this.listaMateriales = datos;
    });
  }

  toggleFormProv(): void {
    this.mostrarFormularioProv = !this.mostrarFormularioProv;
    this.mostrarFormularioPrecio = false;
    this.cdr.detectChanges();
  }

  toggleFormPrecio(): void {
    this.mostrarFormularioPrecio = !this.mostrarFormularioPrecio;
    this.mostrarFormularioProv = false;
    this.cdr.detectChanges();
  }

  guardarProveedor(): void {
    if (!this.nuevoProveedor.nombre) {
      this.snackBar.open('⚠️ El nombre es obligatorio', 'Cerrar', { duration: 3000 });
      return;
    }

    this.proveedorService.crearProveedor(this.nuevoProveedor).subscribe({
      next: () => {
        this.snackBar.open('✅ Proveedor registrado', 'Genial', { duration: 3000 });
        this.mostrarFormularioProv = false;
        this.cargarProveedores();
        this.nuevoProveedor.nombre = '';
      }
    });
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
        // Reiniciamos los valores numéricos
        this.nuevoPrecio = { id_proveedor: 0, id_material: 0, precio_unitario: 0, descuento_porcentaje: 0 };
        this.cdr.detectChanges();
      }
    });
  }

  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    
    if (archivo) {
      // Pequeña validación de seguridad en Angular
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un archivo de Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }

      this.snackBar.open('⏳ Leyendo y subiendo archivo...', '', { duration: 2000 });

      this.proveedorService.importarProveedoresExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          // Si hubo filas con errores (ej. cédulas falsas o duplicados), le avisamos al usuario
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Detalle de errores:', respuesta.errores);
            alert(`Se importaron los proveedores correctamente, pero ignoramos algunas filas con errores:\n\n${respuesta.errores.join('\n')}`);
          }

          this.cargarProveedores(); // Refrescamos la tabla para ver la magia
          event.target.value = ''; // Limpiamos el botón por si quieren subir otro Excel
        },
        error: (err) => {
          console.error(err);
          const mensaje = err.error?.detail || 'Error al procesar el archivo Excel';
          this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }
}